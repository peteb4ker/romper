/**
 * The message for a favorite toggle that failed, worded as Pete approved on
 * #554 and #607. The kit editor (`useKitEditorLogic.toggleFavorite`) and the
 * kit browser (`useKitFilters.handleToggleFavorite`) both show it.
 *
 * @param kitName the kit's slot name, e.g. "A0"
 * @param wasFavorite whether the kit was a favorite before the toggle, so the
 *   message says which way it failed
 */
export function favoriteFailedMessage(
  kitName: string,
  wasFavorite: boolean,
): string {
  return wasFavorite
    ? `Couldn't remove kit ${kitName} from favorites. Try again.`
    : `Couldn't add kit ${kitName} to favorites. Try again.`;
}
