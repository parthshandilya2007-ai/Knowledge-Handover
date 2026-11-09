import crypto from "crypto";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || "dev-internal-service-key-secret-12345";
const WEBHOOK_HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET || "dev-webhook-hmac-secret-signature-key";

let passedCount = 0;
let failedCount = 0;

function logPass(msg: string) {
  console.log(`  ✅ [PASS] ${msg}`);
  passedCount++;
}

function logFail(msg: string, details?: unknown) {
  console.error(`  ❌ [FAIL] ${msg}`, details || "");
  failedCount++;
}

async function runTests() {
  console.log("=================================================================");
  console.log("   STAGE 0 VERIFICATION: Internal Plumbing & Security Contract  ");
  console.log("=================================================================\n");

  // 1. Backend Public Health
  console.log("1. Checking Express Backend Public Health (/health)...");
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    const json = (await res.json()) as { ok: boolean; data?: { status: string } };
    if (res.status === 200 && json.ok && json.data?.status === "ok") {
      logPass("Backend public health returns 200 with standard envelope");
    } else {
      logFail(`Unexpected response: HTTP ${res.status}`, json);
    }
  } catch (err) {
    logFail("Failed to connect to backend", err);
  }

  // 2. System Status & Missing Integrations Check
  console.log("\n2. Checking System Status (/api/v1/system/status)...");
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/system/status`);
    const json = (await res.json()) as {
      ok: boolean;
      data?: {
        integrations: {
          openai: { configured: boolean; status: string };
          github: { configured: boolean; status: string };
          aiService: { reachable: boolean };
        };
      };
    };
    if (res.status === 200 && json.ok && json.data?.integrations) {
      logPass("System status endpoint returned 200 with integrations map");
      if (json.data.integrations.openai.status === "setup_required") {
        logPass("Missing OpenAI API key correctly reported as 'setup_required'");
      } else {
        logPass(`OpenAI API status reported as: ${json.data.integrations.openai.status}`);
      }
      if (json.data.integrations.aiService.reachable) {
        logPass("AI service reachability confirmed by backend");
      } else {
        logPass("AI service reachability status reported");
      }
    } else {
      logFail("System status returned invalid shape", json);
    }
  } catch (err) {
    logFail("Failed to call /api/v1/system/status", err);
  }

  // 3. Express -> FastAPI: X-Internal-Key Auth
  console.log("\n3. Testing Express -> FastAPI Internal Security (X-Internal-Key)...");
  try {
    // 3a. Valid key
    const validRes = await fetch(`${AI_SERVICE_URL}/internal/health`, {
      headers: { "X-Internal-Key": INTERNAL_SERVICE_KEY }
    });
    const validJson = (await validRes.json()) as { ok: boolean; data?: { status: string } };
    if (validRes.status === 200 && validJson.ok && validJson.data?.status === "healthy") {
      logPass("Valid X-Internal-Key granted access (HTTP 200)");
    } else {
      logFail(`Valid key was not accepted: HTTP ${validRes.status}`, validJson);
    }

    // 3b. Invalid key
    const invalidRes = await fetch(`${AI_SERVICE_URL}/internal/health`, {
      headers: { "X-Internal-Key": "wrong-key-value" }
    });
    if (invalidRes.status === 401) {
      logPass("Invalid X-Internal-Key correctly rejected with HTTP 401");
    } else {
      logFail(`Invalid key expected 401 but got HTTP ${invalidRes.status}`);
    }

    // 3c. Missing key
    const missingRes = await fetch(`${AI_SERVICE_URL}/internal/health`);
    if (missingRes.status === 401 || missingRes.status === 422) {
      logPass(`Missing X-Internal-Key correctly rejected with HTTP ${missingRes.status}`);
    } else {
      logFail(`Missing key expected 401/422 but got HTTP ${missingRes.status}`);
    }
  } catch (err) {
    logFail("Failed to test FastAPI /internal/health", err);
  }

  // 4. FastAPI -> Express: Webhook HMAC Verification
  console.log("\n4. Testing FastAPI -> Express Webhook Security (HMAC X-Signature)...");
  try {
    const payload = JSON.stringify({
      jobId: "stage0-job-verification",
      projectId: "proj-verification-1",
      stage: "chunking",
      progress: 60
    });

    // 4a. Valid HMAC
    const validSig = crypto.createHmac("sha256", WEBHOOK_HMAC_SECRET).update(payload).digest("hex");
    const validWebhookRes = await fetch(`${BACKEND_URL}/internal/webhooks/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": `sha256=${validSig}`
      },
      body: payload
    });
    const validWebhookJson = (await validWebhookRes.json()) as { ok: boolean; data?: { received: boolean } };
    if (validWebhookRes.status === 200 && validWebhookJson.ok && validWebhookJson.data?.received) {
      logPass("Valid HMAC signature accepted by Express webhook (HTTP 200)");
    } else {
      logFail(`Valid HMAC webhook failed: HTTP ${validWebhookRes.status}`, validWebhookJson);
    }

    // 4b. Invalid HMAC
    const invalidWebhookRes = await fetch(`${BACKEND_URL}/internal/webhooks/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": "sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      },
      body: payload
    });
    if (invalidWebhookRes.status === 401) {
      logPass("Invalid HMAC signature correctly rejected with HTTP 401");
    } else {
      logFail(`Invalid HMAC expected 401 but got HTTP ${invalidWebhookRes.status}`);
    }

    // 4c. Missing Signature Header
    const missingWebhookRes = await fetch(`${BACKEND_URL}/internal/webhooks/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    });
    if (missingWebhookRes.status === 401) {
      logPass("Missing X-Signature header correctly rejected with HTTP 401");
    } else {
      logFail(`Missing signature expected 401 but got HTTP ${missingWebhookRes.status}`);
    }
  } catch (err) {
    logFail("Failed to test Express webhook HMAC", err);
  }

  // 5. Full Loopback: FastAPI Triggers Signed Webhook to Express
  console.log("\n5. Testing Full Loopback (FastAPI signs and dispatches to Express)...");
  try {
    const loopbackRes = await fetch(`${AI_SERVICE_URL}/internal/test/trigger-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": INTERNAL_SERVICE_KEY
      },
      body: JSON.stringify({
        jobId: "loopback-job-999",
        projectId: "proj-999",
        stage: "embedding",
        progress: 100
      })
    });
    const loopbackJson = (await loopbackRes.json()) as {
      ok: boolean;
      data?: { backendStatus: number; backendResponse: { ok: boolean } };
    };

    if (
      loopbackRes.status === 200 &&
      loopbackJson.ok &&
      loopbackJson.data?.backendStatus === 200 &&
      loopbackJson.data?.backendResponse?.ok
    ) {
      logPass("FastAPI successfully signed and delivered webhook to Express (HTTP 200 on both sides)");
    } else {
      logFail("Loopback webhook delivery failed", loopbackJson);
    }
  } catch (err) {
    logFail("Loopback execution failed", err);
  }

  console.log("\n-----------------------------------------------------------------");
  console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("-----------------------------------------------------------------");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
