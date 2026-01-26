import { FileMeta } from "@/types/hyperview";

export function MediaRenderer({ meta }: { meta: FileMeta }) {
  const src = `preview://${encodeURIComponent(meta.path)}`;

  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      {meta.previewType === 'video' ? (
        <video
          src={src}
          controls
          autoPlay
          className="max-w-full max-h-full outline-none"
        />
      ) : (
        <audio src={src} controls className="w-96" />
      )}
    </div>
  );
}
