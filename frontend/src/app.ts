import * as hass from 'home-assistant-js-websocket';
import { saveTokens, loadTokens } from './auth-util';
import { RoombaState, AppState, BatteryStatus, RoombaStatus, Position3D } from './types';
import axios from 'axios';

declare global {
    interface Window { 
        auth: hass.Auth;
        connection: hass.Connection;
        user: hass.HassUser;
        hass: typeof hass;

        state: AppState;
    }
}

async function onMount() {
    let auth: hass.Auth;

    window.state = {};

    const authOptions: hass.getAuthOptions = {
        saveTokens,
        loadTokens,
    };

    try {
        auth = await hass.getAuth(authOptions);
    } catch (err) {
        
        if (err === hass.ERR_HASS_HOST_REQUIRED) {
            const hassUrl = prompt(
                'What host to connect to?',
                'http://localhost:8123'
                );
                if (!hassUrl) return;
                auth = await hass.getAuth({
                    ...authOptions,
                    hassUrl
                });
            } else {
                alert(`Unknown error: ${err}`);
                return;
            }
        }

    const connection = await hass.createConnection({ auth });

    hass.subscribeEntities(connection, (entities) => {
        window.state.entities = entities;
        const roombaState = getRoombaState(entities);
        window.state.roombaState = roombaState;

        renderEntitiesTable(connection, entities);
        renderRoombaCard(connection);
        updateMap(window.state.position!, window.state.prevPosition);
    });

    hass.subscribeServices(connection, (services) => {
        window.state.services = services;
    });

    // Clear url if we have been able to establish a connection
    if (location.search.includes('auth_callback=1')) {
        history.replaceState(null, '', location.pathname);
    }
    
    // To play from the console
    window.auth = auth;
    window.connection = connection;
    window.state.connection = connection;
    hass.getUser(connection).then((user) => {
        window.state.user = user;

        const header = document.querySelector('.header-text');
        if (header) header.innerHTML = `${user.name}'s Home`;
    });
    window.hass = hass;
}
    
function renderEntitiesTable(connection: hass.Connection, entities: hass.HassEntities) {
    const root = document.querySelector('tbody.sensors-table');
    while (root?.lastChild) root.removeChild(root.lastChild);
    
    Object.keys(entities)
        .sort()
        .forEach((entId) => {
            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.innerHTML = entId;
            tr.appendChild(tdName);
            
            const tdState = document.createElement('td');
            const text = document.createTextNode(entities[entId].state);
            tdState.appendChild(text);
            
            const ent = entId.split('.', 1)[0];
            if (['switch', 'light', 'input_boolean'].includes(ent)) {
                const button = document.createElement('button');
                button.innerHTML = 'toggle';
                button.onclick = () => {
                    hass.callService(connection, 'homeassistant', 'toggle', {
                        entity_id: entId,
                    });
                };
                tdState.appendChild(button);
            }

            const attrs = entities[entId].attributes;
            const iconAttrs = Object.keys(attrs)
                .reduce<Record<string, string>>((acc, cur) => {
                    if (cur.includes('icon')) {
                        acc[cur] = attrs[cur];
                    }
                    return acc;
                }, {});

            Object.keys(iconAttrs)
                .forEach((attrName) => tdState.prepend(createIcon(iconAttrs[attrName])));

            tr.appendChild(tdState);           
            root?.appendChild(tr);
        });
}

function renderRoombaCard(connection: hass.Connection) {
    const root = document.querySelector('.roomba-actions')

    while (root?.lastChild) root.removeChild(root.lastChild);

    const roombaState = window.state.roombaState!;
    
    console.log(roombaState);
    
    // render status items
    let statusStr: string = roombaState.status;
    if (roombaState.batteryStatus === BatteryStatus.CHARGING && roombaState.batteryLevel <= 100) {
        statusStr += `, ${BatteryStatus.CHARGING}` 
    }
    document.querySelector('.roomba-status-text')!.innerHTML = statusStr;
    document.querySelector('.roomba-name')!.innerHTML = roombaState.friendlyName;

    // render battery status
    document.querySelector('.roomba-battery-status')!.innerHTML = 
        `Battery: ${roombaState.batteryLevel}% ${createIcon(roombaState.batteryIcon!).outerHTML}`;

    // render bin status
    document.querySelector('.roomba-bin-status')!.innerHTML =
        `Bin: ${roombaState.isBinFull ? 'Full' : 'OK'} ${createIcon(roombaState.binIcon!).outerHTML}`;

    // render position
    document.querySelector('.roomba-position')!.innerHTML =
        `Position: (${window.state.position!.join(', ')})`;

    // render action buttons
    const actionContainer = document.querySelector('.roomba-actions')!;
    switch(roombaState.status) {
        case RoombaStatus.DOCKED:
            actionContainer.appendChild(createButton('Start', () => {
                hass.callService(connection, 'vacuum', 'start', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Started vacuuming.');
            }));

            break;

        case RoombaStatus.IDLE:
            actionContainer.appendChild(createButton('Locate', () => {
                hass.callService(connection, 'vacuum', 'locate', undefined, { entity_id: roombaState.entityId });
            }));

            actionContainer.appendChild(createButton('Start', () => {
                hass.callService(connection, 'vacuum', 'start', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Started vacuuming.');
            }));

            actionContainer.appendChild(createButton('Return Home', () => {
                hass.callService(connection, 'vacuum', 'return_to_base', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Returning home.');
            }));

            break;

        case RoombaStatus.RETURNING:
            actionContainer.appendChild(createButton('Stop', () => {
                hass.callService(connection, 'vacuum', 'stop', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Stopping.');
            }));

            break;

        case RoombaStatus.CLEANING:
            actionContainer.appendChild(createButton('Locate', () => {
                hass.callService(connection, 'vacuum', 'locate', undefined, { entity_id: roombaState.entityId });
            }));

            actionContainer.appendChild(createButton('Stop', () => {
                hass.callService(connection, 'vacuum', 'stop', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Stopping.');
            }));

            actionContainer.appendChild(createButton('Return Home', () => {
                hass.callService(connection, 'vacuum', 'return_to_base', undefined, { entity_id: roombaState.entityId });
                sendAppwiseEvent('Returning home.');
            }));
            
            break;
    }
}

function sendAppwiseEvent(message: string, id: string = '1337'): void {
    const uuid = 'e6cfb7e7-9ad8-4a90-8e81-885053d73bcd';
    axios.post(`https://60d8cd0cc5a4.ngrok.io/api/events/${uuid}`, {
        id,
        message
    }, {
        headers: {'Access-Control-Allow-Origin': '*'}
    });
}

function createIcon(className: string): HTMLElement {
    const icon_class = className.replace(':', '-');
    const icon = document.createElement('span');
    icon.setAttribute('class', `mdi ${icon_class}`);
    return icon;
}

function createButton(label: string, onClick: (this: GlobalEventHandlers, ev: MouseEvent) => unknown): HTMLButtonElement {
    const button = document.createElement('button');
    button.setAttribute('class', `btn btn-outline-secondary`);
    button.innerHTML = label;
    button.onclick = onClick;
    
    return button;
}

function getRoombaState(entities?: hass.HassEntities): RoombaState {
    const state: RoombaState = {
        entityId: 'vacuum.roomba',
        friendlyName: 'Roomba',
        status: RoombaStatus.UNKNOWN,
        batteryStatus: BatteryStatus.UNKNOWN,
        batteryLevel: -1,
    };

    if (entities) {
        const roombaEntity = entities[state.entityId];

        console.log(roombaEntity)
        state.friendlyName = roombaEntity.attributes.friendly_name || state.friendlyName;
        state.batteryLevel = roombaEntity.attributes.battery_level;
        state.batteryIcon = roombaEntity.attributes.battery_icon;

        if (roombaEntity.state === 'docked') state.status = RoombaStatus.DOCKED;
        else if (roombaEntity.state === 'idle') state.status = RoombaStatus.IDLE;
        else if (roombaEntity.state === 'cleaning') state.status = RoombaStatus.CLEANING;
        else if (roombaEntity.state === 'returning') state.status = RoombaStatus.RETURNING;

        if (roombaEntity.attributes.status === 'Charging') state.batteryStatus = BatteryStatus.CHARGING;

        if (roombaEntity.attributes.bin_present && roombaEntity.attributes.bin_full) state.isBinFull = true;
        state.binIcon = state.isBinFull ? 'mdi-delete' : 'mdi-delete-variant';

        if (roombaEntity.attributes.position) {
            window.state.prevPosition = window.state.position;
            const reg = /\((-?\d+),\s*(-?\d+),\s*(-?\d+)\)/gm;
            const [anything, x, y, r, ...rest] = reg.exec(roombaEntity.attributes.position)!;
            console.log(x,y,r)
            window.state.position = [parseInt(x), parseInt(y), parseInt(r)];
        }
    };

    return state;
}

function updateMap(position: Position3D, prevPosition?: Position3D): void {
    console.log(prevPosition);
    if (!prevPosition) {
        // no-op
    } else {
        // offsets
        const ox = 200;
        const oy = 200;

        const canvas = document.getElementById('map')! as HTMLCanvasElement;

        const ctx = canvas.getContext('2d')!;

        console.log(ctx);
        // ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(prevPosition[0] + ox, prevPosition[1] + oy);
        ctx.lineTo(position[0] + ox, position[1] + oy);
        ctx.stroke();
    }
}

onMount();