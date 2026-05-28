# GLB Character Integration

## Current State

- Main character asset: `web/src/assets/characters/manny.glb`
- Loader: `web/src/character/gltfLoader.ts`
- Runtime entry: `web/src/main.ts`
- The old FBX asset was replaced because browser texture paths were brittle.

## Visual Checks

Playwright screenshots were used to verify the GLB import:

- `web/test-results/manny-glb-load-framed.png`
- `web/test-results/manny-glb-arms-raised.png`

Verified:

- GLB textures and materials load without the FBX material fallback.
- The character is scaled to roughly 1.7m and snapped to the ground.
- Camera framing shows the full character.
- Mock pose input raises both arms in the rendered scene.

## Retargeting Notes

Only arm retargeting is active for now:

- `upperarm_l` from shoulder to elbow
- `upperarm_r` from shoulder to elbow
- `lowerarm_l` from elbow to wrist
- `lowerarm_r` from elbow to wrist

The implementation stores bind/rest world transforms from the loaded skeleton, then converts target world rotations into each bone parent's local space before applying them. This avoids the previous issue where world-space pose rotations were copied directly into local bone quaternions.

## Test Policy

Use Playwright for final visual confidence. Keep small unit tests only where the bug is math-heavy or hard to diagnose from screenshots, such as parent-space retargeting.
