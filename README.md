# book-appointment-component
Front end React component that allows a 3rd party website to add appointment/event booking functionality.

## Installation
Run 'npm install'

## Getting Started 
1. Run 'npm run start-dev'. This will run a local http server that can be accessed on http://localhost:3001
2. Obtain an integrationId __*value*__ and pass it as query param to http://localhost:3001?integrationId=*value*

## Integration notes
On narrow layouts the footer with the Back / Book buttons sticks to the bottom of the screen while the widget is on screen, and the summary of the previous choices sticks to the top. Past the widget they scroll away with it, so the content of the page below the widget is never covered.
- Room for the host page: set `--appBookingStickyOffset` (e.g. for a cookie banner, a chat bubble or a bottom bar) and `--appBookingScrollOffset` (e.g. for a fixed header) on `.appBookingWidget` or an ancestor:
  ```css
  .appBookingWidget { --appBookingStickyOffset: 64px; --appBookingScrollOffset: 72px; }
  ```
- Sticky positioning only works when no element wrapping the widget has `overflow: hidden`, `auto` or `scroll`. Inside such an element the footer and summary scroll along with the rest of the widget, as before.
- On step change the widget's top is brought back into view (below `--appBookingScrollOffset`) and the focus moves to the new step's title.

## Desk booking widget
A separate widget books one desk for one or more days through the seating API (see `docs/ABB-150-public-desk-booking-flow.md`). It is built into its own bundle, `public/js/appBookingDesks.js` (library `appBookingDesks`), next to the appointment widget, and uses the same `public/css/style.css`.

- Try it at http://localhost:3001/desks.html?integrationId=*value*. The page calls `http://localhost:8000` by default; pass `apiBase=...` to use another backend.
- Flow: desk service and floor (skipped when there is only one) → days and start time → desk → personal data → confirmation. The desk is held for 10 minutes from the moment it is chosen.
- Render it with `React.createElement(appBookingDesks.AppBookingDesks, { integrationId, appBookingApiBaseUrl, locale, configs, utm_params, initialSelections })`. `configs` takes the same `step_personal_data`, `termsAndConditions` and `text` settings as the appointment widget.
- `initialSelections.skuid` (the human-readable sku code) limits the widget to one desk service, and `initialSelections.venue` (a venue id) preselects its floor.

## Event booking widget (concert tickets, trainings)
A separate widget books tickets or places at a seat event through the seating API (see `docs/ABB-150-public-concert-booking-flow.md` and `docs/ABB-150-public-training-booking-flow.md`). It is built into its own bundle, `public/js/appBookingEvents.js` (library `appBookingEvents`), and uses the same `public/css/style.css`.

- Try it at http://localhost:3001/events.html?integrationId=*value*. Add `eventType=concert` or `eventType=training` to list only that kind of event. The page calls `http://localhost:8000` by default; pass `apiBase=...` to use another backend. Only the seat services linked to the booking page are listed by `seating/catalog`.
- Concert (an event with a venue): event → seats by area and row, plus a number of places in standing areas → personal data → confirmation.
- Training (an event with no venue): event → number of places (one place covers every session; the schedule lists the sessions) → personal data → confirmation.
- The tickets or places are held for 10 minutes once the tickets step is confirmed. Going back releases the hold; when it expires the customer chooses again from an empty selection. A `409` on the hold drops the seats that were taken (or lowers the number of places) and asks the customer to choose again.
- Render it with `React.createElement(appBookingEvents.AppBookingEvents, { integrationId, appBookingApiBaseUrl, locale, eventType, configs, utm_params, initialSelections })`. `configs` takes the same `step_personal_data`, `termsAndConditions` and `text` settings as the appointment widget; a text key ending in `.training` overrides the wording for trainings.
- `initialSelections.skuid` (the human-readable sku code) limits the widget to one ticket service, and `initialSelections.event` (a seat event id) preselects an event that is on sale.

## Documentation
You can find the documentation on the [appBooking.io website](https://www.appbooking.io).

## License
React is [MIT licensed](./LICENSE).