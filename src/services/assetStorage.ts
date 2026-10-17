import type { CustomAsset } from "../domain/types";

const DATABASE = "pipelab-assets";
const STORE = "models";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listStoredAssets(): Promise<CustomAsset[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE)
      .getAll();
    request.onsuccess = () => resolve(request.result as CustomAsset[]);
    request.onerror = () => reject(request.error);
  });
}

export async function storeAsset(asset: CustomAsset): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(
      asset,
    );
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
