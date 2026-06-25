import { contextBridge } from 'electron';

import { buildKuaimaiApi } from './apis/build-api';

contextBridge.exposeInMainWorld('kuaimai', buildKuaimaiApi());
