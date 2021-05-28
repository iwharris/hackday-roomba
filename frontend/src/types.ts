import { Connection, HassEntities, HassServices, HassUser } from 'home-assistant-js-websocket';

export interface AppState {
    entities?: HassEntities;
    services?: HassServices;
    user?: HassUser;

    connection?: Connection;
}

export interface RoombaState {
    entityId: string;

    status: RoombaStatus;
    batteryStatus: BatteryStatus;

    batteryLevel: number;
    batteryIcon?: string;

    isBinFull?: boolean;
    binIcon?: string;
}

export enum RoombaStatus {
    UNKNOWN = 'Unknown',
    DOCKED = 'Docked',
    IDLE = 'Idle',
    CLEANING = 'Cleaning',
    RETURNING = 'Returning Home',
}

export enum BatteryStatus {
    UNKNOWN = 'Unknown',
    CHARGING = 'Charging',
}