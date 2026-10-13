
/*
A grid of selectable items. props.variant picks the look: 'tiles' for short names (categories, specialists),
'cards' for the services.
*/
export function CustomList(props) {

    function onSelect(item, index) {
        if (!props.onSelectItem) {
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
        return (
            <div key={item.id !== undefined ? item.id : index} className={classValue}
                 role="button" tabIndex={0} aria-pressed={isSelected}
                 onClick={ () => { onSelect(item, index) } } onKeyDown={ (e) => { onKeyDown(e, item, index) } }>
                <div className="appBookingListItemContent"> { props.itemContent(item, isSelected) } </div>
            </div>
        )
    }

    return (
        <div className={"appBookingList appBookingList_" + (props.variant || 'tiles')}>
            { props.items.map( (item, index) => getItemContent(index, item) ) }
        </div>
    )
}
