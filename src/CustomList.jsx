
import { useState } from 'react';

/*
A grid of selectable items. props.variant picks the look: 'tiles' for short names (categories, specialists),
'cards' for the services.
props.isItemDisabled(item) marks the items that are shown but can't be chosen.
With props.maxVisible only the first items are shown, followed by a "show more" button labelled
props.moreLabel(hiddenCount). The selected item is always shown.
*/
export function CustomList(props) {
    const [ showAll, setShowAll ] = useState(false);

    function isDisabled(item) {
        return !!props.isItemDisabled && props.isItemDisabled(item);
    }

    function onSelect(item, index) {
        if (!props.onSelectItem || isDisabled(item)) {
            return;
        }
        props.onSelectItem(item, index)
    }

    function onKeyDown(e, item, index) {
        if ((e.target === e.currentTarget) && ((e.key === 'Enter') || (e.key === ' '))) {
            e.preventDefault();
            onSelect(item, index);
        }
    }

    function getItemContent(index, item) {
        const isSelected = (props.selectedId !== null) && (props.selectedId !== undefined) && (item.id === props.selectedId);
        let classValue = "appBookingListItem";
        if (isSelected) {
            classValue += " appBookingActiveListItem";
        }
        const disabled = isDisabled(item);
        if (disabled) {
            classValue += " appBookingListItemDisabled";
        }
        return (
            <div key={item.id !== undefined ? item.id : index} className={classValue}
                 role="button" tabIndex={disabled ? -1 : 0} aria-pressed={isSelected} aria-disabled={disabled || undefined}
                 onClick={ () => { onSelect(item, index) } } onKeyDown={ (e) => { onKeyDown(e, item, index) } }>
                <div className="appBookingListItemContent"> { props.itemContent(item, isSelected) } </div>
            </div>
        )
    }

    const hasSelection = (props.selectedId !== null) && (props.selectedId !== undefined);
    const selectedIndex = hasSelection ? props.items.findIndex( item => item.id === props.selectedId ) : -1;
    // a single hidden item takes about the space of the button, so it is shown instead
    const limit = props.maxVisible && (props.items.length > props.maxVisible + 1) && !showAll && (selectedIndex < props.maxVisible) ? props.maxVisible : props.items.length;

    return (
        <>
            <div className={"appBookingList appBookingList_" + (props.variant || 'tiles')}>
                { props.items.slice(0, limit).map( (item, index) => getItemContent(index, item) ) }
            </div>
            { (limit < props.items.length) && (
                <button type="button" className="appBookingListMoreButton" onClick={ () => setShowAll(true) }>
                    { props.moreLabel ? props.moreLabel(props.items.length - limit) : '...' }
                </button>
            )}
        </>
    )
}
