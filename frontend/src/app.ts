import * as hass from 'home-assistant-js-websocket';
import { saveTokens, loadTokens } from './auth-util';

declare global {
    interface Window { 
        auth: any;
        connection: hass.Connection;
        user: any;
    }
}

async function onMount() {
    let auth: hass.Auth;

    const authOptions: hass.getAuthOptions = {
        saveTokens,
        loadTokens,
    };

    try {
        auth = await hass.getAuth(authOptions);
    } catch (err) {
        
        if (err === hass.ERR_HASS_HOST_REQUIRED) {
            const hassUrl = prompt(
                "What host to connect to?",
                "http://localhost:8123"
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
    hass.subscribeEntities(connection, (entities) =>
    renderEntities(connection, entities)
    );
    // Clear url if we have been able to establish a connection
    if (location.search.includes("auth_callback=1")) {
        history.replaceState(null, "", location.pathname);
    }
    
    // To play from the console
    window.auth = auth;
    window.connection = connection;
    hass.getUser(connection).then((user) => {
        console.log("Logged in as", user);
        window.user = user;
    });
}
    
function renderEntities(connection: hass.Connection, entities: hass.HassEntities) {
    const root = document.querySelector("tbody");
    while (root?.lastChild) root.removeChild(root.lastChild);
    
    Object.keys(entities)
    .sort()
    .forEach((entId) => {
        const tr = document.createElement("tr");
        
        const tdName = document.createElement("td");
        tdName.innerHTML = entId;
        tr.appendChild(tdName);
        
        const tdState = document.createElement("td");
        const text = document.createTextNode(entities[entId].state);
        tdState.appendChild(text);
        
        const ent = entId.split(".", 1)[0];
        if (["switch", "light", "input_boolean"].includes(ent)) {
            const button = document.createElement("button");
            button.innerHTML = "toggle";
            button.onclick = () =>
            hass.callService(connection, "homeassistant", "toggle", {
                entity_id: entId,
            });
            tdState.appendChild(button);
        }

        tr.appendChild(tdState);
        
        root?.appendChild(tr);
    });
}

onMount();