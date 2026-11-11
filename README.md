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
- Since ABB-162 a desk service has a single price (`sku.price`) and books only the desks of its `priceCategories` (empty: every desk); the list leaves the other desks out and the map shows them closed.
- Floor map: when the layout's `venue.mapContent` holds an SVG map, the desk step shows it with a Map / List toggle (map first). The SVG is sanitised again with DOMPurify before it's inserted (`<style>` and `<foreignObject>` are dropped too). Every element with a `data-seat-code` matching a layout desk becomes a button and gets the classes `appBookingDeskMapSeat`, `appBookingDeskMapSeat_free|_taken|_closed` and `appBookingDeskMapSeatSelected`. Codes that aren't in the layout get `appBookingDeskMapSeat_unknown`. A desk's text is centred on its own `x`/`y` (`text-anchor: middle`, `dominant-baseline: central`), so the map must place that point at the desk's centre. Desks missing from the map are counted under it, with a link to the list.

## Event booking widget (concert tickets, trainings)
A separate widget books tickets or places at a seat event through the seating API (see `docs/ABB-150-public-concert-booking-flow.md` and `docs/ABB-150-public-training-booking-flow.md`). It is built into its own bundle, `public/js/appBookingEvents.js` (library `appBookingEvents`), and uses the same `public/css/style.css`.

- Try it at http://localhost:3001/events.html?integrationId=*value*. Add `eventType=concert` or `eventType=training` to list only that kind of event. The page calls `http://localhost:8000` by default; pass `apiBase=...` to use another backend. Only the seat services linked to the booking page are listed by `seating/catalog`.
- Concert (an event with a venue): event → seats by area and row, plus a number of places in standing areas → personal data → confirmation.
- Training (an event with no venue): event → number of places (one place covers every session; the schedule lists the sessions) → personal data → confirmation.
- The tickets or places are held for 10 minutes once the tickets step is confirmed. Going back releases the hold; when it expires the customer chooses again from an empty selection. A `409` on the hold drops the seats that were taken (or lowers the number of places) and asks the customer to choose again.
- Render it with `React.createElement(appBookingEvents.AppBookingEvents, { integrationId, appBookingApiBaseUrl, locale, eventType, configs, utm_params, initialSelections })`. `configs` takes the same `step_personal_data`, `termsAndConditions` and `text` settings as the appointment widget; a text key ending in `.training` overrides the wording for trainings.
- Ticket types (ABB-162, see `docs/ABB-162-sku-event-types.md`): `seating/catalog` lists the events at the top level, each with its `ticketTypes` (one `SeatEventSku` service each, with one price). A type sells the seats and standing areas whose `priceCategory` is in its `priceCategories` (empty: any seat or place). A chosen seat gets the first type in display order that sells it and has room left; when several types sell it, the list of chosen seats has a ticket type picker. Standing areas and events with no venue have a number of places per ticket type. Limits: the event's `maxSeatsPerBooking` in all, and per type its `maxPerBooking` and what is left of its `quota` (live from `seating/availability` `ticketTypes`). Seats no type on sale sells get `appBookingEventMapSeat_closed` on the map. Every reservation item carries its `serviceSkuId`; a `409` on a type's quota lowers that type's units.
- `initialSelections.skuid` (the human-readable sku code of a ticket type) limits the widget to the events selling that ticket type, and to that type, and `initialSelections.event` (a seat event id) preselects an event that is on sale.
- Venue map: when the layout's `venue.mapContent` holds an SVG map, the tickets step of a concert shows it with a Map / List toggle (map first), sanitised the same way as the desk map (shared `src/utils/SeatMap.jsx`). Every element with a `data-seat-code` matching a layout seat becomes a button and gets `appBookingEventMapSeat`, `appBookingEventMapSeat_free|_taken`, `appBookingEventMapSeatSelected` and, for marked kinds, `appBookingEventMapSeat_kind_wheelchair|_companion|_restricted_view`; clicking a chosen seat again removes it. Elements with a `data-area-code` get `appBookingEventMapArea`, `appBookingEventMapArea_seated|_standing` and `appBookingEventMapArea_free|_full`; a standing area is a button that moves to its number-of-places picker, listed under the map. Seat labels and the labels inside a standing area are centred on their own `x`/`y` (`text-anchor: middle`, `dominant-baseline: central`, unless the text sets these attributes itself), so the map must place that point at the centre. Codes that aren't in the layout get `_unknown`. Seats missing from the map are counted under it, with a link to the list; the chosen seats are listed as removable chips.

## Documentation
You can find the documentation on the [appBooking.io website](https://www.appbooking.io).

## License
React is [MIT licensed](./LICENSE).