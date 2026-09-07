import { describe, expect, it, vi } from 'vitest';
import { enableMiddleMousePan } from '../src/map/middle-mouse-pan';

function mouseEvent(type: string, properties: Record<string, number>): MouseEvent {
  const event = new Event(type, { cancelable: true }) as MouseEvent;
  for (const [name, value] of Object.entries(properties)) {
    Object.defineProperty(event, name, { value });
  }
  return event;
}

function setup() {
  const canvas = new EventTarget() as HTMLCanvasElement;
  Object.defineProperty(canvas, 'style', { value: { cursor: '' } });
  const eventWindow = new EventTarget() as Window;
  const panBy = vi.fn();
  const stop = vi.fn();
  const cleanup = enableMiddleMousePan(
    {
      getCanvas: () => canvas,
      panBy,
      stop,
    },
    eventWindow,
  );

  return { canvas, cleanup, eventWindow, panBy, stop };
}

describe('middle-mouse panning', () => {
  it('moves the map beneath a held middle mouse button', () => {
    const { canvas, cleanup, eventWindow, panBy, stop } = setup();
    const down = mouseEvent('mousedown', { button: 1, clientX: 200, clientY: 180 });
    canvas.dispatchEvent(down);
    eventWindow.dispatchEvent(
      mouseEvent('mousemove', { buttons: 4, clientX: 235, clientY: 155 }),
    );

    expect(down.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalledOnce();
    expect(panBy).toHaveBeenCalledWith([-35, 25], { duration: 0 });
    expect(canvas.style.cursor).toBe('grabbing');
    cleanup();
  });

  it('ends the gesture when the middle button is released', () => {
    const { canvas, cleanup, eventWindow, panBy } = setup();
    canvas.dispatchEvent(mouseEvent('mousedown', { button: 1, clientX: 100, clientY: 100 }));
    eventWindow.dispatchEvent(mouseEvent('mouseup', { button: 1 }));
    eventWindow.dispatchEvent(
      mouseEvent('mousemove', { buttons: 0, clientX: 140, clientY: 140 }),
    );

    expect(panBy).not.toHaveBeenCalled();
    expect(canvas.style.cursor).toBe('');
    cleanup();
  });

  it('leaves primary-button dragging to MapLibre', () => {
    const { canvas, cleanup, eventWindow, panBy, stop } = setup();
    const down = mouseEvent('mousedown', { button: 0, clientX: 200, clientY: 180 });
    canvas.dispatchEvent(down);
    eventWindow.dispatchEvent(
      mouseEvent('mousemove', { buttons: 1, clientX: 235, clientY: 155 }),
    );

    expect(down.defaultPrevented).toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(panBy).not.toHaveBeenCalled();
    cleanup();
  });
});
