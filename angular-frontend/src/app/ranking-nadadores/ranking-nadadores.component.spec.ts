import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RankingNadadoresComponent } from './ranking-nadadores.component';

describe('RankingNadadoresComponent', () => {
  let component: RankingNadadoresComponent;
  let fixture: ComponentFixture<RankingNadadoresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RankingNadadoresComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RankingNadadoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
