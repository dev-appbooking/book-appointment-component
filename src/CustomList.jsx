
export function CustomList(props) {
    
    function onClick(e, item, index) {
        if (!props.onSelectItem) {
            return;
        }
        props.onSelectItem(item, index)
    }
    function getItemContent(index, item) {

        let classValue = "appBookingListItem";
        if (item.id === props.selectedId && props.onSelectItem) {
            classValue = "appBookingListItem appBookingActiveListItem";
        }
        if (!props.onSelectItem) {
            classValue = "appBookingListItemSimple";
        }
        return (
            <div key={index} className={classValue} onClick={ (e) => { onClick(e, item, index) } } > 
                <div class="appBookingListItemContent"> { props.itemContent(item, props.selectedId === item.id) } </div>
            </div>
        )
    }

    return (
            <>
                <div className="appBookingList">
                { 
                    props.items.map( (item, index) => {
                        return getItemContent(index, item);
                    }) 
                } 
                </div>
            </>
        )
}