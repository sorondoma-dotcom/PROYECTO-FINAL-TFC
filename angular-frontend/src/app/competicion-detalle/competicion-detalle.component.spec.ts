import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompeticionDetalleComponent } from './competicion-detalle.component';

describe('CompeticionDetalleComponent', () => {
  let component: CompeticionDetalleComponent;
  let fixture: ComponentFixture<CompeticionDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompeticionDetalleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompeticionDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
