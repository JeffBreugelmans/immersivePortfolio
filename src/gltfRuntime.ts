// gltfRuntime.ts
//
// Shared GLTF loader for Mint-generated GLBs (rigged avatar, animation
// clips, future props). Mint's optimizer can emit KHR_draco_mesh_compression,
// which a bare GLTFLoader rejects; every Mint GLB path must go through this
// helper so a single lazily-fetched Draco decoder covers them all. The
// decoder wasm only downloads if a Draco primitive is actually encountered.

import type { LoadingManager } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MINT_DRACO_DECODER_PATH =
  "https://cdn.mint.gg/runtime/draco/gltf/three-0.184.0/";

const dracoLoaders = new Map<string, DRACOLoader>();

function sharedDracoLoader(decoderPath: string): DRACOLoader {
  const path = decoderPath.endsWith("/") ? decoderPath : `${decoderPath}/`;
  let loader = dracoLoaders.get(path);
  if (!loader) {
    loader = new DRACOLoader().setDecoderPath(path);
    dracoLoaders.set(path, loader);
  }
  return loader;
}

export function createMintGltfLoader(
  options: { manager?: LoadingManager; decoderPath?: string } = {}
): GLTFLoader {
  const loader = new GLTFLoader(options.manager);
  return loader.setDRACOLoader(
    sharedDracoLoader(options.decoderPath ?? MINT_DRACO_DECODER_PATH)
  );
}

export function disposeMintGltfRuntime(): void {
  dracoLoaders.forEach((loader) => loader.dispose());
  dracoLoaders.clear();
}
