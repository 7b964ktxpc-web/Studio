# Main UI presence integration

Use this compact block inside `askScreen` without rewriting the existing page.

## Markup

```html
<div id="presenceBlock" data-presence-state="OFF" class="card presenceCard">
  <div class="presenceTop">
    <div>
      <div data-presence-state class="presenceTitle">Не беспокоить</div>
      <div data-presence-accuracy class="meta">Точность неизвестна</div>
    </div>
    <button type="button" data-presence-toggle class="pill">Включить «Я рядом»</button>
  </div>
  <div data-presence-radius class="meta">Основной радиус 50 м · максимум 250 м</div>
</div>
```

## Behaviour

The screen owns one `createPresenceService()` instance. Do not create one service per render.

- Default state: `OFF`.
- Toggle from `OFF` starts the service.
- Toggle from `ENABLED`, `LOW_ACCURACY`, or `STARTING` stops it.
- `onChange` updates the block only.
- `onError` shows a non-blocking error message and never fabricates `ENABLED`.
- Do not show raw latitude/longitude.
- Do not start background geolocation unless the browser/platform has explicitly granted permission.

## Reference implementation

```js
async function mountPresenceBlock(root, supabaseClient) {
  const service = NowPresenceService.createPresenceService(supabaseClient, {
    onChange(snapshot) {
      NowPresenceWidget.renderPresenceState(root, snapshot);
    },
    onError(error) {
      showToast(error.message || 'Не удалось обновить статус «Я рядом»');
    },
  });

  NowPresenceWidget.mountPresenceToggle(root, service);
  return () => service.stop();
}
```

The integration must remain opt-in and must preserve the proximity policy: 50 → 100 → 150 → 250 m, never beyond 250 m.
