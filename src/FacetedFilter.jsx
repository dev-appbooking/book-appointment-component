
export function FacetedFilter(props) { 
const ltext = props.ltext;
function onChangeItem(filterGroupId, filterItemId) {
    if (props.onChange) {
        props.onChange(filterGroupId, filterItemId);
    }
}

function getCheckedValue(filterGroupId, filterItemId) {
    return props.filterData.filterSelections[filterGroupId] && props.filterData.filterSelections[filterGroupId][filterItemId];
}

return (
    <>
        { props.filterData.filterItems.map ( filterGroupItem => {
            if (filterGroupItem.values.length < 2) {
                // do not show filter if there are less than 2 possible options
                return;
            }
            return ( 
                <div key={filterGroupItem.title_key} className="appBookingFacetGroup">
                    <div className="appBookingFacetGroupHeader"> { ltext.text(filterGroupItem.title_key) } </div>
                    { filterGroupItem.values.map ((filterItem) => {
                            return ( <div key={filterItem.id} className="appBookingFacetGroupItem"> 
                                        <input className="" id={filterItem.id} type="checkbox" checked={ getCheckedValue(filterGroupItem, filterItem.id) } onChange={ () => { onChangeItem(filterGroupItem.id, filterItem.id) } } /> 
                                        <label className="" htmlFor={filterItem.id} > { filterItem.value } </label> 
                                    </div>) 
                        })
                    }
                </div> )
        })
        }
            
    </>)
}