import { MediaSurface, type MediaSurfaceProps } from "../media/MediaSurface.js";

export type VideoSurfaceProps = Omit<MediaSurfaceProps, "mediaKind">;

export function VideoSurface(props: VideoSurfaceProps) {
  return <MediaSurface {...props} mediaKind="video" />;
}
