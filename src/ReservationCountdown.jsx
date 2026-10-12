import { useState, useEffect } from 'react';

function formatTimeLeft(ms) {
    let totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/*
Shows how long the held slot stays reserved. props.text holds a {0} placeholder for the time left.
Only displays the time; the parent decides what happens when the reservation expires.
*/
export function ReservationCountdown(props) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        setNow(Date.now());
        let timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [props.expiresAt]);

    let [before, after] = props.text.split('{0}');
    return (
        <div className="appBookingReservationTimer appBookingWarningText">
            { before }<span className="appBookingReservationTimerValue">{ formatTimeLeft(props.expiresAt - now) }</span>{ after }
        </div>
    );
}
