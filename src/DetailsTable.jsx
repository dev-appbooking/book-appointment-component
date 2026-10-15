/*
The label / value rows that summarize a booking. rows: [ { id, label, value } ]; a value can hold several lines.
*/
export function DetailsTable(props) {
    return (
        <div className="appBookingDetails">
            { props.rows.filter( row => row && row.value ).map( row => (
                <div key={row.id} className="appBookingDetailsRow">
                    <div className="appBookingDetailsLabel">{ row.label }</div>
                    <div className="appBookingDetailsValue">
                        { (Array.isArray(row.value) ? row.value : [row.value]).filter(Boolean).map( (line, index) => (
                            <div key={index} className="appBookingDetailsValueLine">{ line }</div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
