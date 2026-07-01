import { registerAuthIpc } from './auth';
import { registerConfigIpc } from './config';
import { registerDebugIpc } from './debug';
import { registerSkuImportIpc } from './tools/sku-import';
import { registerUploadIpc } from './upload';

export function registerAllIpcHandlers(): void {
  registerConfigIpc();
  registerUploadIpc();
  registerAuthIpc();
  registerDebugIpc();
  registerSkuImportIpc();
}
