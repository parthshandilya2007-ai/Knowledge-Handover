import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { IHandoverReport } from "../models/HandoverReport.js";
import { Project } from "../models/Project.js";
import { Evidence } from "../models/Evidence.js";
import { Source } from "../models/Source.js";

export class PdfExportService {
  /**
   * Generates a styled, readable PDF stream for a handover report.
   * Items must already be viewer-filtered via accessService.
   */
  async generateReportPdf(report: IHandoverReport): Promise<Buffer> {
    const project = await Project.findById(report.projectId);
    const projectName = project ? project.name : "Project Handover";

    // Gather citations across all sections
    const allCitationIds = report.sections.flatMap((s) =>
      s.items.flatMap((it) => (it.citations || []).map((c) => c.toString()))
    );

    const evidenceList = await Evidence.find({
      _id: { $in: allCitationIds },
    });

    const sourceIds = Array.from(new Set(evidenceList.map((e) => e.sourceId.toString())));
    const sources = await Source.find({ _id: { $in: sourceIds } });
    const sourceMap = new Map<string, string>();
    for (const s of sources) {
      sourceMap.set(s._id.toString(), s.title);
    }

    const evidenceMap = new Map<string, { quote: string; sourceTitle: string; locator?: any }>();
    for (const ev of evidenceList) {
      evidenceMap.set(ev._id.toString(), {
        quote: ev.quote,
        sourceTitle: sourceMap.get(ev.sourceId.toString()) || "Project Artifact",
        locator: ev.locator,
      });
    }

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `${projectName} - Handover Report v${report.version}`,
          Author: "Knowledge Handover Platform",
          Subject: "Evidence-linked project handover",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Title & Header Banner
      doc
        .fontSize(22)
        .fillColor("#0B1533")
        .text("Knowledge Handover Report", { align: "left" });

      doc.moveDown(0.3);
      doc
        .fontSize(14)
        .fillColor("#142650")
        .text(projectName, { align: "left" });

      doc.moveDown(0.2);
      doc
        .fontSize(10)
        .fillColor("#556987")
        .text(
          `Version: v${report.version}   |   Status: ${report.status.toUpperCase()}   |   Generated: ${new Date(
            report.createdAt
          ).toLocaleDateString()}`
        );

      doc.moveDown(0.5);
      doc
        .strokeColor("#26D6C1")
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1);

      // Section Iteration
      let sectionIndex = 1;
      for (const section of report.sections) {
        // Avoid orphaned headers
        if (doc.y > 680) {
          doc.addPage();
        }

        // Section Heading
        doc
          .fontSize(14)
          .fillColor("#0B1533")
          .text(`${String(sectionIndex).padStart(2, "0")}. ${section.title}`, { underline: false });

        doc.moveDown(0.4);

        if (section.items.length === 0) {
          doc
            .fontSize(9)
            .fillColor("#8896AB")
            .text("No items documented in this section.", { indent: 15 });
          doc.moveDown(0.8);
          sectionIndex++;
          continue;
        }

        for (const item of section.items) {
          if (doc.y > 720) {
            doc.addPage();
          }

          const isHidden = item.text === "1 item hidden: restricted source";

          if (isHidden) {
            doc
              .fontSize(9)
              .fillColor("#D97706")
              .text(`* [RESTRICTED] 1 item hidden: cites a restricted source.`, {
                indent: 15,
                lineGap: 2,
              });
            doc.moveDown(0.4);
            continue;
          }

          // Item bullet & text
          let prefix = "• ";
          if (item.flag === "conflict") prefix = "[!] [CONFLICT] ";
          else if (item.flag === "uncertain") prefix = "[?] [UNCERTAIN] ";

          doc
            .fontSize(10)
            .fillColor(item.flag === "conflict" ? "#E11D48" : "#1E293B")
            .text(`${prefix}${item.text}`, {
              indent: 15,
              lineGap: 2,
            });

          // Citations Snippets
          if (item.citations && item.citations.length > 0) {
            for (const citeId of item.citations) {
              const ev = evidenceMap.get(citeId.toString());
              if (ev) {
                doc
                  .fontSize(8)
                  .fillColor("#475569")
                  .text(
                    `    Evidence: "${ev.quote}" — Source: ${ev.sourceTitle}`,
                    { indent: 25, lineGap: 1 }
                  );
              }
            }
          }

          doc.moveDown(0.4);
        }

        doc.moveDown(0.8);
        sectionIndex++;
      }

      // Footer
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor("#94A3B8")
          .text(
            `Knowledge Handover Platform — Confidential & Permission-Aware — Page ${i + 1} of ${
              range.count
            }`,
            50,
            780,
            { align: "center", width: 495 }
          );
      }

      doc.end();
    });
  }
}

export const pdfExportService = new PdfExportService();
