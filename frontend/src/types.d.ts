import { Connection, HassEntities, HassServices, HassUser } from 'home-assistant-js-websocket';

export interface State {
    entities?: HassEntities;
    services?: HassServices;
    user?: HassUser;

    connection?: Connection;
}