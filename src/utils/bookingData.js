/*
Helpers for the version 2 booking data (GET bookingData?version=2).

In version 2 every sku carries `skuScheduleGroups`: a list of groups, each a list of schedules
({ scheduleId, entityType: 'specialist' | 'resource', entityId, locationId, departmentIds }).
Booking the sku takes one schedule from every group, e.g. a specialist and a room.

The widget works with bookable options: { sku, data: [ { specialist, location, departments, scheduleIds, resourceSchedules } ] }.
- the customer picks the specialist: one option per schedule of the first group that has specialists.
  The other groups are left to the server, limited to their schedules at the same location.
- a sku that needs no specialist gets one option per location, with `specialist: null`.
`scheduleIds` is what the slot search (availableSlots) is narrowed to.
`resourceSchedules` holds, per group, the resources the option can use: [ [ { resource, scheduleId } ] ].
*/

function mapById(list) {
    let res = {};
    (list || []).forEach( item => {
        res[String(item.id)] = item;
    });
    return res;
}

function unique(values) {
    return Array.from(new Set(values));
}

function schedulesAtLocation(group, locationId) {
    return group.filter( entry => String(entry.locationId) === String(locationId) ).map( entry => entry.scheduleId );
}

// the resources of every group at the location, groups without resources are left out
function resourceSchedulesAtLocation(groups, locationId, resources) {
    return groups.map( group => group.filter( entry => (entry.entityType === 'resource') && (String(entry.locationId) === String(locationId)) && resources[String(entry.entityId)] )
                                     .map( entry => ({ resource: resources[String(entry.entityId)], scheduleId: entry.scheduleId }) ) )
                 .filter( group => group.length > 0 );
}

function optionsForSku(skuData) {
    skuData = skuData || {};
    const groups = (skuData.skuScheduleGroups || []).filter( group => Array.isArray(group) && group.length > 0 );
    const specialists = mapById(skuData.specialists);
    const locations = mapById(skuData.locations);
    const resources = mapById(skuData.resources);
    const departments = mapById(skuData.departments);
    const departmentsOf = (departmentIds) => unique((departmentIds || []).map(String)).map( id => departments[id] ).filter(Boolean);

    let options = [];
    const primaryIndex = groups.findIndex( group => group.some( entry => entry.entityType === 'specialist' ) );

    if (primaryIndex >= 0) {
        const otherGroups = groups.filter( (group, index) => index !== primaryIndex );
        groups[primaryIndex].forEach( entry => {
            const specialist = specialists[String(entry.entityId)];
            const location = locations[String(entry.locationId)];
            if ((entry.entityType !== 'specialist') || !specialist || !location) {
                return;
            }
            const partnerSchedules = otherGroups.map( group => schedulesAtLocation(group, entry.locationId) );
            if (partnerSchedules.some( schedules => schedules.length === 0 )) {
                // some group has nothing at this location, so it cannot be booked here
                return;
            }
            options.push({
                specialist: specialist,
                location: location,
                departments: departmentsOf(entry.departmentIds),
                scheduleIds: unique([ entry.scheduleId, ...partnerSchedules.flat() ]),
                resourceSchedules: resourceSchedulesAtLocation(otherGroups, entry.locationId, resources)
            });
        });
    } else if (groups.length > 0) {
        unique(groups[0].map( entry => String(entry.locationId) )).forEach( locationId => {
            const location = locations[locationId];
            const schedules = groups.map( group => schedulesAtLocation(group, locationId) );
            if (!location || schedules.some( list => list.length === 0 )) {
                return;
            }
            const departmentIds = groups.flat().filter( entry => String(entry.locationId) === locationId ).flatMap( entry => entry.departmentIds || [] );
            options.push({
                specialist: null,
                location: location,
                departments: departmentsOf(departmentIds),
                scheduleIds: unique(schedules.flat()),
                resourceSchedules: resourceSchedulesAtLocation(groups, locationId, resources)
            });
        });
    }
    return options;
}

export function bookingOptionsFromV2(skus) {
    return (skus || []).map( skuWrapper => ({ sku: skuWrapper.sku, data: optionsForSku(skuWrapper.data) }) );
}

// the distinct resources an option can use
export function optionResources(option) {
    let res = {};
    (option.resourceSchedules || []).flat().forEach( entry => {
        res[String(entry.resource.id)] = entry.resource;
    });
    return Object.values(res);
}

/*
The schedules of an option when the customer filters on resources (selectedResourceIds keyed by resource id):
in every group that has a selected resource only the selected ones stay, the other groups are kept as they are.
Returns null when the option uses none of the selected resources.
*/
export function scheduleIdsForResources(option, selectedResourceIds) {
    let dropped = [];
    let matches = false;
    (option.resourceSchedules || []).forEach( group => {
        const isSelected = (entry) => !!selectedResourceIds[String(entry.resource.id)];
        if (group.some(isSelected)) {
            matches = true;
            dropped.push( ...group.filter( entry => !isSelected(entry) ).map( entry => entry.scheduleId ) );
        }
    });
    if (!matches) {
        return null;
    }
    return (option.scheduleIds || []).filter( id => dropped.indexOf(id) < 0 );
}

// every specialist, resource and schedule of the booking data by id, used to name the owners of a slot or booking
export function buildCatalog(skus) {
    let catalog = { specialists: {}, resources: {}, schedules: {} };
    (skus || []).forEach( skuWrapper => {
        let skuData = skuWrapper.data || {};
        Object.assign(catalog.specialists, mapById(skuData.specialists));
        Object.assign(catalog.resources, mapById(skuData.resources));
        (skuData.skuScheduleGroups || []).flat().forEach( entry => {
            catalog.schedules[String(entry.scheduleId)] = entry;
        });
    });
    return catalog;
}

export function specialistFullName(specialist) {
    if (!specialist) {
        return '';
    }
    return `${specialist.title || ''} ${specialist.firstName || ''} ${specialist.lastName || ''}`.trim();
}

/*
Names of who else a slot or booking uses besides the chosen specialist (resources, staff of the other groups).
owners is the `owners` list of a Slot or a booking.
*/
export function assignedOwnerNames(owners, catalog, mainSpecialistId) {
    catalog = catalog || { specialists: {}, resources: {} };
    let names = [];
    (owners || []).forEach( owner => {
        if (owner.resourceId) {
            let resource = catalog.resources[String(owner.resourceId)];
            names.push(resource ? (resource.name || String(resource.id)) : String(owner.resourceId));
        } else if (owner.specialistId && (String(owner.specialistId) !== String(mainSpecialistId))) {
            let specialist = catalog.specialists[String(owner.specialistId)];
            if (specialist) {
                names.push(specialistFullName(specialist));
            }
        }
    });
    return unique(names);
}

/*
Names of who a slot uses besides the chosen specialist. A slot has `owners` only for skus with several
schedule groups; otherwise its schedules name the specialist or resource.
*/
export function slotOwnerNames(slot, catalog, mainSpecialistId) {
    if (!slot) {
        return [];
    }
    let owners = slot.owners;
    if (!owners || (owners.length === 0)) {
        const schedules = (catalog && catalog.schedules) || {};
        owners = (slot.scheduleIds || [slot.scheduleId]).map( id => schedules[String(id)] ).filter(Boolean)
                    .map( entry => (entry.entityType === 'resource') ? { resourceId: entry.entityId } : { specialistId: entry.entityId } );
    }
    return assignedOwnerNames(owners, catalog, mainSpecialistId);
}
