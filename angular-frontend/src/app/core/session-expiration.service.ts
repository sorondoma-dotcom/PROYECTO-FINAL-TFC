import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionExpirationService {
  private dialogOpen = false;

  isOpen(): boolean {
    return this.dialogOpen;
  }

  setOpen(v: boolean) {
    this.dialogOpen = v;
  }
}
