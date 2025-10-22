import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-timeline-chart',
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './timeline-chart.component.html',
  styleUrls: ['./timeline-chart.component.scss']
})
export class TimelineChartComponent  {
  @Input() name: any;
  @Input() times: any[] = [];
  @Output() close = new EventEmitter<void>();
  

}

