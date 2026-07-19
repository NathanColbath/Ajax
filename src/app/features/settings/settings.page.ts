import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AjaxAccordion, AjaxExpansion, AjaxSlideToggle } from '../../shared/ui';

@Component({
  selector: 'ajax-settings-page',
  standalone: true,
  imports: [FormsModule, AjaxAccordion, AjaxExpansion, AjaxSlideToggle],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  emailDigest = true;
  compactNav = false;
}
