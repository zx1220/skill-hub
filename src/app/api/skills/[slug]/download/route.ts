import { getSkillDetail, getSkillFiles } from "@/lib/storage";
import { safeError } from "@/lib/api-utils";
import { Readable } from "stream";
import { ZipArchive } from "archiver";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const skill = getSkillDetail(slug);
    if (!skill) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const files = getSkillFiles(slug);

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
