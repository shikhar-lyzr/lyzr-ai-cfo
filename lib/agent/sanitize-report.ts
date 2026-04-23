// Strip agent-speak narration that the Lyzr router sometimes prepends to
// generated reports ("The report has been generated and saved. You can refer
// to artifact ID ... for the full markdown."). The narration is not part of
// the report — downstream viewers render the body as-is, so the preamble
// surfaces verbatim in the UI.
//
// Only the TOP of the body is considered; artifact-ID mentions and
// "generated" phrasing mid-document are assumed to be legitimate content.

const LEADING_NARRATION_PATTERNS: RegExp[] = [
  // "The <Report Title> has been generated and saved. You can refer to artifact ID <uuid> for the full markdown content."
  /^[^\n]*?has been generated and saved\.[^\n]*?artifact ID[^\n]*?\.\s*/i,
  // Bare "The report has been generated and saved."
  /^[^\n]*?has been generated and saved\.\s*/i,
  // "Here is the monthly close package report for <period>:"
  /^Here is the [^\n]*?report[^\n]*?:\s*/i,
  // "<Title> has been generated and saved." (no trailing artifact phrasing)
];

export function sanitizeReportBody(body: string): string {
  let out = body;
  for (const pat of LEADING_NARRATION_PATTERNS) {
    out = out.replace(pat, "");
  }
  return out.trimStart();
}
