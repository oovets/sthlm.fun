const ERRORS = {
  1: 'platsåtkomst nekades i webbläsaren',
  2: 'positionen kunde inte bestämmas',
  3: 'tog för lång tid att hitta positionen',
};

export async function geolocationPermission() {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'prompt';
  }
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('webbläsaren saknar positionering'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lngLat: [pos.coords.longitude, pos.coords.latitude], accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(ERRORS[err.code] ?? err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}
