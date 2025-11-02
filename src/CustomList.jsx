
export function CustomList(props) {
    
    function getItemContent(index, item) {

        let classValue = "appBookingListItem";
        if (index === props.selectedIndex) {
            classValue = "appBookingListItem appBookingActiveListItem";
        }
        return (
            <div key={index} className={classValue} onClick={ (e) => { e.stopPropagation(); props.onSelectItem(item, index) } } > 
                <div class="appBookingListItemContent"> { props.itemContent(item, index === props.selectedIndex) } </div>
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