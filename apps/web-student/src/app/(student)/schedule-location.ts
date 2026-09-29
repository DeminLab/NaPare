export function getLessonLocation(building?: string | null, room?: string | null): string | null {
  const buildingName = building?.trim();
  const roomName = room?.trim();
  const parts = [buildingName, roomName ? `ауд. ${roomName}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
