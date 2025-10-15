import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// Accept the optional BootstrapContext passed by the SSR engine and forward it to
// bootstrapApplication so the platform is available during server rendering.
const bootstrap = (context?: BootstrapContext) => bootstrapApplication(AppComponent, config, context);

export default bootstrap;
