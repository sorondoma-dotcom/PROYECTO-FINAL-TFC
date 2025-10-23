// Carga Google Charts solo una vez y expone la API global
declare global {
  interface Window {
    google: any;
  }
}

export function loadGoogleCharts(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google && window.google.charts) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/charts/loader.js';
    script.onload = () => {
      window.google.charts.load('current', { packages: ['corechart'] });
      window.google.charts.setOnLoadCallback(() => resolve());
    };
    document.body.appendChild(script);
  });
}
