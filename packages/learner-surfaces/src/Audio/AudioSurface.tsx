import { MediaSurface, type MediaSurfaceProps } from "../media/MediaSurface.js";

export type AudioSurfaceProps = Omit<MediaSurfaceProps, "mediaKind">;

export function AudioSurface(props: AudioSurfaceProps) {
  return <MediaSurface {...props} mediaKind="audio" />;
}
