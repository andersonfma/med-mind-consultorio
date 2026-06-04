export function hasAvailableSlot(usedSlots: number, totalSlots: number): boolean {
  return usedSlots < totalSlots
}
