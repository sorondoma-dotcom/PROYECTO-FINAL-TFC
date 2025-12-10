import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { DatosService } from '../services/datos.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CountryFlagPipe } from '../pipes/country-flag.pipe';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface Athlete {
  athleteId?: number;
  name: string;
  nationality?: string;
  country?: string;
  gender?: string;
  age?: number;
  birth?: string;
  imageUrl?: string;
  profileUrl?: string;
  club?: string;
  bestResults?: any[];
}

@Component({
  selector: 'app-buscar-atletas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule,
    MatPaginatorModule,
    CountryFlagPipe
  ],
  templateUrl: './buscar-atletas.component.html',
  styleUrls: ['./buscar-atletas.component.scss']
})
export class BuscarAtletasComponent implements OnInit {
  searchForm!: FormGroup;
  athletes: Athlete[] = [];
  filteredAthletes: Athlete[] = [];
  paginatedAthletes: Athlete[] = [];
  loading = false;
  error: string | null = null;
  
  // Paginación
  pageSize = 20;
  pageIndex = 0;
  totalAthletes = 0;

  // Opciones de filtros
  genders = [
    { value: '', label: 'Todos' },
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' }
  ];

  nationalities: string[] = [];
  ageRanges = [
    { value: '', label: 'Todas las edades' },
    { value: '0-15', label: 'Menores de 15' },
    { value: '15-18', label: '15-18 años' },
    { value: '18-25', label: '18-25 años' },
    { value: '25-30', label: '25-30 años' },
    { value: '30+', label: 'Mayores de 30' }
  ];

  constructor(
    private fb: FormBuilder,
    private datosService: DatosService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadAthletes();
    this.setupSearchListener();
  }

  private initForm(): void {
    this.searchForm = this.fb.group({
      name: [''],
      nationality: [''],
      gender: [''],
      ageRange: ['']
    });
  }

  private setupSearchListener(): void {
    // Buscar automáticamente mientras el usuario escribe (con debounce)
    this.searchForm.get('name')?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.applyFilters();
      });
  }

  loadAthletes(): void {
    this.loading = true;
    this.error = null;

    this.datosService.getAthletes({ limit: 10000 }).subscribe({
      next: (response) => {
        console.log('📊 Respuesta de atletas:', response);
        
        // Manejar diferentes formatos de respuesta del backend PHP
        const athletesList = Array.isArray(response) 
          ? response 
          : Array.isArray(response?.data) 
            ? response.data
            : Array.isArray(response?.atletas) 
              ? response.atletas 
              : Array.isArray(response?.athletes)
                ? response.athletes
                : [];

        this.athletes = athletesList.map((athlete: any) => this.mapAthlete(athlete));
        this.filteredAthletes = [...this.athletes];
        this.totalAthletes = this.filteredAthletes.length;
        
        // Extraer nacionalidades únicas para el filtro
        this.extractNationalities();
        
        // Aplicar paginación inicial
        this.updatePagination();
        
        this.loading = false;
        console.log(`✅ ${this.athletes.length} atletas cargados`);
      },
      error: (err) => {
        console.error('❌ Error al cargar atletas:', err);
        this.error = err?.error?.error || err?.error?.message || err?.message || 'Error al cargar atletas';
        this.loading = false;
      }
    });
  }

  private mapAthlete(data: any): Athlete {
    const age = this.calculateAge(data?.birth ?? data?.birthDate);
    return {
      athleteId: data?.athlete_id ?? data?.athleteId ?? data?.id ?? null,
      name: data?.athlete_name ?? data?.name ?? data?.athleteName ?? '',
      nationality: data?.country_code ?? data?.nationality ?? data?.country ?? data?.countryCode ?? '',
      country: data?.country_code ?? data?.country ?? data?.countryCode ?? data?.nationality ?? '',
      gender: data?.gender ?? data?.sex ?? '',
      age: age ?? undefined,
      birth: data?.birth ?? data?.birthDate ?? '',
      imageUrl: data?.image_url ?? data?.imageUrl ?? '',
      profileUrl: data?.profile_url ?? data?.profileUrl ?? '',
      club: data?.club ?? data?.team ?? '',
      bestResults: data?.bestResults ?? []
    };
  }

  private extractNationalities(): void {
    const nationalitySet = new Set<string>();
    this.athletes.forEach(athlete => {
      const nat = athlete.nationality || athlete.country;
      if (nat) nationalitySet.add(nat);
    });
    this.nationalities = Array.from(nationalitySet).sort();
  }

  onSearch(): void {
    this.applyFilters();
  }

  onReset(): void {
    this.searchForm.reset({
      name: '',
      nationality: '',
      gender: '',
      ageRange: ''
    });
    this.applyFilters();
  }

  applyFilters(): void {
    const formValues = this.searchForm.value;
    
    this.filteredAthletes = this.athletes.filter(athlete => {
      // Filtro por nombre
      if (formValues.name) {
        const searchTerm = this.normalize(formValues.name);
        const athleteName = this.normalize(athlete.name);
        if (!athleteName.includes(searchTerm)) {
          return false;
        }
      }

      // Filtro por nacionalidad
      if (formValues.nationality) {
        const athleteNat = (athlete.nationality || athlete.country || '').toUpperCase();
        if (athleteNat !== formValues.nationality.toUpperCase()) {
          return false;
        }
      }

      // Filtro por género
      if (formValues.gender) {
        if (athlete.gender?.toUpperCase() !== formValues.gender.toUpperCase()) {
          return false;
        }
      }

      // Filtro por rango de edad
      if (formValues.ageRange && athlete.age) {
        const age = athlete.age;
        const [minAge, maxAge] = this.parseAgeRange(formValues.ageRange);
        
        if (minAge !== null && age < minAge) return false;
        if (maxAge !== null && age > maxAge) return false;
      }

      return true;
    });

    this.totalAthletes = this.filteredAthletes.length;
    this.pageIndex = 0; // Resetear a la primera página
    this.updatePagination();
  }

  private parseAgeRange(range: string): [number | null, number | null] {
    if (range === '0-15') return [0, 15];
    if (range === '15-18') return [15, 18];
    if (range === '18-25') return [18, 25];
    if (range === '25-30') return [25, 30];
    if (range === '30+') return [30, null];
    return [null, null];
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagination();
  }

  private updatePagination(): void {
    const startIndex = this.pageIndex * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedAthletes = this.filteredAthletes.slice(startIndex, endIndex);
  }

  verPerfil(athlete: Athlete): void {
    if (!athlete.name) {
      console.warn('⚠️ Atleta sin nombre');
      return;
    }

    const nameParam = encodeURIComponent(athlete.name);
    
    this.router.navigate(['/nadadores', 'perfil', nameParam], {
      queryParams: {
        country: athlete.nationality || athlete.country || '',
        imageUrl: athlete.imageUrl || '',
        profileUrl: athlete.profileUrl || '',
        age: athlete.age || null,
        gender: athlete.gender || null,
        athleteId: athlete.athleteId || null
      },
      state: {
        performer: athlete
      }
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  private calculateAge(birth: string | null | undefined): number | null {
    if (!birth) return null;
    
    const date = new Date(birth);
    if (isNaN(date.getTime())) return null;
    
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  private normalize(value: string): string {
    return (value || '').toLowerCase().trim();
  }

  getGenderLabel(gender: string | undefined): string {
    if (gender?.toUpperCase() === 'M') return 'Masculino';
    if (gender?.toUpperCase() === 'F') return 'Femenino';
    return 'N/A';
  }

  get hasFiltersApplied(): boolean {
    const values = this.searchForm.value;
    return !!(values.name || values.nationality || values.gender || values.ageRange);
  }

  get resultadosTexto(): string {
    if (this.filteredAthletes.length === 0) {
      return 'No se encontraron atletas';
    }
    
    const start = this.pageIndex * this.pageSize + 1;
    const end = Math.min((this.pageIndex + 1) * this.pageSize, this.totalAthletes);
    
    return `Mostrando ${start}-${end} de ${this.totalAthletes} atleta${this.totalAthletes !== 1 ? 's' : ''}`;
  }
}
