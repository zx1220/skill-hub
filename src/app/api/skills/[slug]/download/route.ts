import { getSkillDetail, getSkillFiles } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { Readable } from "stream";
import { ZipArchive } from "archiver";

// Vercel: allow up to 60s for zip packaging of large skills.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const skill = await getSkillDetail(slug);
    if (!skill) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const files = await getSkillFiles(slug);

    // Create a zip archive preserving subdirectory structure
    const archive = new ZipArchive({ zlib: { level: 6 } });
    for (const file of files) {
      archive.append(file.content, { name: `${slug}/${file.filename}` });
    }
    archive.finalize();

    // Convert Node.js Readable to Web ReadableStream
    const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
      },
    });
  } catch (e) {
    return safeError(e);
  }
}
