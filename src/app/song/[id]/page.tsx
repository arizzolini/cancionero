import { SongPlayer } from "@/components/song-player";

type SongPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SongPage({ params }: SongPageProps) {
  const { id } = await params;
  return <SongPlayer songId={decodeURIComponent(id)} />;
}
