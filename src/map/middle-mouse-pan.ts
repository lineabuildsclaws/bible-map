const MIDDLE_MOUSE_BUTTON = 1;
const MIDDLE_MOUSE_BUTTON_FLAG = 4;

interface PannableMap {
  getCanvas: () => HTMLCanvasElement;
  panBy: (offset: [number, number], options: { duration: number }) => unknown;
  stop: () => unknown;
}

export function enableMiddleMousePan(map: PannableMap, eventWindow: Window = window): () => void {
  const canvas = map.getCanvas();
  let lastPosition: { x: number; y: number } | undefined;

  const finishPan = (): void => {
    lastPosition = undefined;
    canvas.style.cursor = '';
  };

  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== MIDDLE_MOUSE_BUTTON) return;

    event.preventDefault();
    map.stop();
    lastPosition = { x: event.clientX, y: event.clientY };
    canvas.style.cursor = 'grabbing';
  };

  const handleMouseMove = (event: MouseEvent): void => {
    if (!lastPosition) return;
    if ((event.buttons & MIDDLE_MOUSE_BUTTON_FLAG) === 0) {
      finishPan();
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - lastPosition.x;
    const deltaY = event.clientY - lastPosition.y;
    lastPosition = { x: event.clientX, y: event.clientY };

    if (deltaX !== 0 || deltaY !== 0) {
      // `panBy` moves the camera, while a drag conventionally moves the map
      // beneath the pointer, so the camera offset is the inverse of the drag.
      map.panBy([-deltaX, -deltaY], { duration: 0 });
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (event: MouseEvent): void => {
    if (event.button === MIDDLE_MOUSE_BUTTON) finishPan();
  };

  const preventMiddleAuxClick = (event: MouseEvent): void => {
    if (event.button === MIDDLE_MOUSE_BUTTON) event.preventDefault();
  };

  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('auxclick', preventMiddleAuxClick);
  eventWindow.addEventListener('mousemove', handleMouseMove, { passive: false });
  eventWindow.addEventListener('mouseup', handleMouseUp);
  eventWindow.addEventListener('blur', finishPan);

  return () => {
    canvas.removeEventListener('mousedown', handleMouseDown);
    canvas.removeEventListener('auxclick', preventMiddleAuxClick);
    eventWindow.removeEventListener('mousemove', handleMouseMove);
    eventWindow.removeEventListener('mouseup', handleMouseUp);
    eventWindow.removeEventListener('blur', finishPan);
  };
}
