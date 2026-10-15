import { useState } from 'react';
import { FacetedFilter } from './FacetedFilter.jsx';

/*
Quick filter chips. Every group with more than one value shows up to maxVisible chips (the selected values first);
when a group has more values a '... more values' chip opens the faceted search of that group.
groups: [ { id, label_key, title_key, icon, values: [ { id, value } ] } ], filterSelections: { groupId: { valueId: 1 } }.
*/
export function QuickFilters(props) {
    const [expanded, setExpanded] = useState({});
    const maxVisible = props.maxVisible || 2;
    const selections = props.filterSelections || {};

    function isSelected(groupId, valueId) {
        return !!(selections[groupId] && selections[groupId][valueId]);
    }

    function onToggle(groupId, valueId) {
        if (props.onChange) {
            props.onChange(groupId, valueId);
        }
    }

    function groupContent(group) {
        const selected = group.values.filter( v => isSelected(group.id, v.id) );
        const others = group.values.filter( v => !isSelected(group.id, v.id) );
        const visible = [ ...selected, ...others ].slice(0, Math.max(maxVisible, selected.length));
        const hasMore = visible.length < group.values.length;
        const isExpanded = !!expanded[group.id];

        return (
            <div key={group.id} className="appBookingQuickFilterGroup">
                <div className="appBookingQuickFilterLabel">
                    <span className="appBookingQuickFilterIcon">{ group.icon }</span>
                    <span>{ props.rawTextByKey(group.label_key) }</span>
                </div>
                <div className="appBookingQuickFilterChips">
                    { !isExpanded && visible.map( v => {
                        const active = isSelected(group.id, v.id);
                        return (
                            <button key={v.id} type="button" aria-pressed={active}
                                    className={"appBookingChip" + (active ? " appBookingChipSelected" : "")}
                                    onClick={ () => onToggle(group.id, v.id) }>{ v.value }</button>
                        );
                    })}
                    { (hasMore || isExpanded) &&
                        <button type="button" className="appBookingChip appBookingChipMore" aria-expanded={isExpanded}
                                onClick={ () => setExpanded({ ...expanded, [group.id]: !isExpanded }) }>
                            { props.rawTextByKey(isExpanded ? 'filter.lessValues' : 'filter.moreValues') }
                        </button> }
                </div>
                { isExpanded &&
                    <div className="appBookingQuickFilterFacets">
                        <FacetedFilter filterData={{ filterItems: [ { id: group.id, title_key: group.title_key, values: group.values } ], filterSelections: selections }}
                                       onChange={onToggle} ltext={props.ltext} showTitles={false} />
                    </div> }
            </div>
        );
    }

    const groups = props.groups.filter( group => group.values.length > 1 );
    if (groups.length === 0) {
        return null;
    }
    return (
        <div className="appBookingQuickFilters">
            { groups.map(groupContent) }
        </div>
    );
}
