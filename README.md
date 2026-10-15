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

## Documentation
You can find the documentation on the [appBooking.io website](https://www.appbooking.io).

## License
React is [MIT licensed](./LICENSE).