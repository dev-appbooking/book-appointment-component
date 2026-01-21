
export function CustomList(props) {
    
    function getItemContent(index, item) {

        let classValue = "appBookingListItem";
        if (item.id === props.selectedId) {
            classValue = "appBookingListItem appBookingActiveListItem";
        }
        return (
            <div key={index} className={classValue} onClick={ (e) => { e.stopPropagation(); props.onSelectItem(item, index) } } > 
                <div class="appBookingListItemContent"> { props.itemContent(item, props.selectedId) } </div>
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