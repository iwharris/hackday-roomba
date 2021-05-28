import * as hass from 'home-assistant-js-websocket';
import { saveTokens, loadTokens } from './auth-util';
import { State } from './types';

declare global {
    interface Window { 
        auth: hass.Auth;
        connection: hass.Connection;
        user: hass.HassUser;
        hass: typeof hass;

        state: State;
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
        renderEntitiesTable(connection, entities);
        renderRoombaTable(connection);
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
        console.log('Logged in as', user);
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
                .forEach((attrName) => {
                    const attr = iconAttrs[attrName];
                    const icon_class = attr.replace(':', '-');
                    const icon = document.createElement('span');
                    icon.setAttribute('class', `mdi ${icon_class}`);
                    tdState.prepend(icon);
                });

            tr.appendChild(tdState);           
            root?.appendChild(tr);
        });
}

function renderRoombaTable(connection: hass.Connection) {
    const root = document.querySelector('tbody.services-table')

    while (root?.lastChild) root.removeChild(root.lastChild);
    
    // Object.keys(services)
    //     .filter((service) => service === 'vacuum')
    //     .sort()
    //     .forEach((serviceId) => {
    //         const tr = document.createElement('tr');
            
    //         const tdName = document.createElement('td');
    //         tdName.innerHTML = serviceId;
    //         tr.appendChild(tdName);
            
    //         const tdState = document.createElement('td');
    //         const text = document.createTextNode(entities[entId].state);
    //         tdState.appendChild(text);
            
    //         const ent = entId.split('.', 1)[0];
    //         if (['switch', 'light', 'input_boolean'].includes(ent)) {
    //             const button = document.createElement('button');
    //             button.innerHTML = 'toggle';
    //             button.onclick = () =>
    //             hass.callService(connection, 'homeassistant', 'toggle', {
    //                 entity_id: entId,
    //             });
    //             tdState.appendChild(button);
    //         }

    //         tr.appendChild(tdState);
            
    //         root?.appendChild(tr);
    //     });
    console.log(services);
}

onMount();