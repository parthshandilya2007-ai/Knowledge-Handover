const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000/api/v1";

let passed = 0;
let failed = 0;

function logPass(msg: string) {
  console.log(`  ✅ [PASS] ${msg}`);
  passed++;
}

function logFail(msg: string, details?: unknown) {
  console.error(`  ❌ [FAIL] ${msg}`, details || "");
  failed++;
}

async function runStage2Verification() {
  console.log("=================================================================");
  console.log("   STAGE 2 VERIFICATION: User Journey, Orgs, Projects & RBAC     ");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const testEmail = `stage2-founder-${timestamp}@handover.internal`;
  const inviteEmail = `stage2-teammate-${timestamp}@handover.internal`;
  let authToken = "";
  let orgId = "";
  let projectId = "";

  // 1. Register a new user
  console.log("1. Testing Registration Flow (POST /auth/register)...");
  try {
    const res = await fetch(`${BACKEND_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Stage 2 Founder",
        email: testEmail,
        password: "SecretPassword123!"
      })
    });
    const json = (await res.json()) as any;
    if (res.status === 201 && json.ok && json.data.token) {
      authToken = json.data.token;
      logPass(`User registered successfully (${testEmail}) with JWT token returned`);
    } else {
      logFail("Registration failed", json);
    }
  } catch (err) {
    logFail("Failed to call register endpoint", err);
  }

  // 2. Route Guard Check (Unauthenticated request rejected)
  console.log("\n2. Testing Route Guard (Unauthenticated Access)...");
  try {
    const res = await fetch(`${BACKEND_URL}/projects`);
    const json = (await res.json()) as any;
    if (res.status === 401 && !json.ok) {
      logPass("Unauthenticated request to /projects correctly rejected (HTTP 401)");
    } else {
      logFail(`Expected 401 but got HTTP ${res.status}`);
    }
  } catch (err) {
    logFail("Route guard check failed", err);
  }

  // 3. Create Organization (Onboarding Step 1)
  console.log("\n3. Testing Organization Creation (POST /orgs)...");
  try {
    const res = await fetch(`${BACKEND_URL}/orgs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: `Titan Tech ${timestamp}`,
        slug: `titan-tech-${timestamp}`
      })
    });
    const json = (await res.json()) as any;
    if (res.status === 201 && json.ok && json.data.org?._id) {
      orgId = json.data.org._id;
      logPass(`Organization created: "${json.data.org.name}" (ID: ${orgId})`);
    } else {
      logFail("Failed to create organization", json);
    }
  } catch (err) {
    logFail("Call to /orgs failed", err);
  }

  // 4. Invite Team Member (Onboarding Step 2)
  console.log("\n4. Testing Member Invitation (POST /orgs/:id/invites)...");
  try {
    const res = await fetch(`${BACKEND_URL}/orgs/${orgId}/invites`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        email: inviteEmail,
        role: "developer"
      })
    });
    const json = (await res.json()) as any;
    if (res.status === 201 && json.ok && json.data.invite?.token) {
      logPass(`Invitation dispatched for ${inviteEmail} with role developer`);
    } else {
      logFail("Member invitation failed", json);
    }
  } catch (err) {
    logFail("Call to /orgs/:id/invites failed", err);
  }

  // 5. Create Project (Onboarding Step 3)
  console.log("\n5. Testing Project Creation (POST /projects)...");
  try {
    const res = await fetch(`${BACKEND_URL}/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        orgId,
        name: "Titan Distributed Engine",
        description: "High-throughput asynchronous event processor"
      })
    });
    const json = (await res.json()) as any;
    if (res.status === 201 && json.ok && json.data.project?._id) {
      projectId = json.data.project._id;
      logPass(`Project created: "${json.data.project.name}" (ID: ${projectId})`);
    } else {
      logFail("Project creation failed", json);
    }
  } catch (err) {
    logFail("Call to /projects failed", err);
  }

  // 6. Verify Dashboard Project Listing (GET /projects)
  console.log("\n6. Testing Dashboard Project Retrieval (GET /projects)...");
  try {
    const res = await fetch(`${BACKEND_URL}/projects`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const json = (await res.json()) as any;
    if (res.status === 200 && json.ok && Array.isArray(json.data.projects)) {
      const found = json.data.projects.find((p: any) => p._id === projectId);
      if (found) {
        logPass(`Project "${found.name}" retrieved successfully in dashboard query`);
      } else {
        logFail("Created project was not returned in /projects list", json);
      }
    } else {
      logFail("Failed to list projects", json);
    }
  } catch (err) {
    logFail("Call to /projects failed", err);
  }

  // 7. Verify Profile Update (PATCH /users/me)
  console.log("\n7. Testing Profile Update (PATCH /users/me)...");
  try {
    const res = await fetch(`${BACKEND_URL}/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ name: "Stage 2 Lead Architect" })
    });
    const json = (await res.json()) as any;
    if (res.status === 200 && json.ok && json.data.user.name === "Stage 2 Lead Architect") {
      logPass("User profile updated to 'Stage 2 Lead Architect'");
    } else {
      logFail("Profile update failed", json);
    }
  } catch (err) {
    logFail("Call to /users/me failed", err);
  }

  console.log("\n-----------------------------------------------------------------");
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("-----------------------------------------------------------------");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage2Verification();

