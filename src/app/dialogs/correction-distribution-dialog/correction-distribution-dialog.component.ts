import { Component, OnInit, Inject, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Chart } from "chart.js";
import tests from "../../tests";
import users from "../../users";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import * as forEach from "lodash.foreach";
import * as slice from "lodash.slice";
import * as includes from "lodash.includes";
import * as without from "lodash.without";
import * as size from "lodash.size";
import * as clone from "lodash.clone";

@Component({
  selector: "app-correction-distribution-dialog",
  templateUrl: "./correction-distribution-dialog.component.html",
  styleUrls: ["./correction-distribution-dialog.component.css"],
})
export class CorrectionDistributionDialogComponent implements OnInit {
  elemGroups: any = {
    a: "link",
    all: "other",
    id: "other",
    img: "image",
    longDImg: "graphic",
    area: "area",
    inpImg: "graphic",
    //graphic buttons
    applet: "object",
    hx: "heading",
    label: "form",
    inputLabel: "form",
    form: "form",
    tableData: "table",
    table: "table",
    tableLayout: "table",
    tableComplex: "table",
    frameset: "frame",
    iframe: "frame",
    frame: "frame",
    embed: "object",
    //embedded object
    object: "object",
    fontValues: "other",
    ehandler: "ehandler",
    w3cValidator: "validator",
  };

  @ViewChild("chart", { static: true }) chartCorrections: any;
  @ViewChild(MatSort, { static: true }) matSort: MatSort;

  chart: any;
  tests: any;
  keys: any;
  tagsSuccess: {}[];
  nPages: number;
  graphData: any;
  dataSource: MatTableDataSource<CorrectionData>;
  columnDefinitions: any[];
  columnDefinitionsMobile: any[];
  existingElemGroups: any;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private translate: TranslateService
  ) {
    this.tests = tests;
    this.nPages = this.data.website.pages.length;
    this.tagsSuccess = [];
    this.graphData = [];
    this.existingElemGroups = [];

    this.columnDefinitions = [
      { def: "level", hide: false },
      { def: "element", hide: false },
      { def: "description", hide: false },
      { def: "scs", hide: false },
      { def: "fps", hide: false },
      { def: "pages", hide: false },
      { def: "pagesPercentage", hide: false },
      { def: "elems", hide: false },
      { def: "quartiles", hide: false },
    ];

    this.columnDefinitionsMobile = [
      { def: "level", hide: false },
      { def: "description", hide: false },
      { def: "pages", hide: false },
    ];

    const tableData: CorrectionData[] = [];
    forEach(this.data.website.tot, (v, key) => {
      if (v["result"] === "passed" || v["result"] === "warning") {
        let elem = v["elem"];
        let n_pages = v["n_pages"];
        let n_websites = v["n_websites"];
        let result = v["result"];

        let quartiles = calculateQuartiles(this.data, key);
        if (!includes(this.existingElemGroups, this.elemGroups[v["elem"]])) {
          this.existingElemGroups.push(this.elemGroups[v["elem"]]);
        }
        // description, element name
        let translations: string[] = [
          "TEST_RESULTS." + key,
          "TEST_ELEMENTS." + elem,
        ];
        tableData.push(this.addToTableData(key, v, translations, quartiles));
        this.graphData.push({ key, elem, n_pages, n_websites, result });
      }
    });

    this.graphData.sort(function (a, b) {
      return b.n_pages === a.n_pages
        ? a.key.localeCompare(b.key)
        : b.n_pages - a.n_pages;
    });

    // because we only want the top 10
    this.graphData = slice(this.graphData, 0, 10);
    this.dataSource = new MatTableDataSource(tableData);
  }

  ngOnInit(): void {
    this.dataSource.sort = this.matSort;

    const translations = this.graphData.map((v, k) => {
      return "TEST_RESULTS." + v["key"];
    });
    translations.push("DIALOGS.corrections.n_corrections");
    translations.push("DIALOGS.corrections.tests_label");
    translations.push("DIALOGS.corrections.situations_label");

    this.translate.get(translations).subscribe((res: any) => {
      const label = res["DIALOGS.corrections.n_corrections"];
      const testsLabel = res["DIALOGS.corrections.tests_label"];
      const situationsLabel = res["DIALOGS.corrections.situations_label"];
      delete res["DIALOGS.corrections.n_corrections"];
      delete res["DIALOGS.corrections.tests_label"];
      delete res["DIALOGS.corrections.situations_label"];

      const labels = Object.values(res).map((s: string) => {
        s = s.replace(new RegExp("<code>", "g"), '"');
        s = s.replace(new RegExp("</code>", "g"), '"');
        s = s.length > 100 ? String(s).substr(0, 97) + "..." : s;
        return this.formatLabel(s, 50);
      });

      const labelsTooltips = Object.values(res).map((s: string) => {
        s = s.replace(new RegExp("<code>", "g"), '"');
        s = s.replace(new RegExp("</code>", "g"), '"');
        return s;
      });

      const values = this.graphData.map((v: any) => v.n_pages);

      this.chart = new Chart(this.chartCorrections.nativeElement, {
        type: "horizontalBar",
        data: {
          labels: labels,
          datasets: [
            {
              label: label,
              data: values,
              backgroundColor: "green",
            },
          ],
        },
        options: {
          tooltips: {
            callbacks: {
              // to make the title appear entirely
              title: function (tooltipItem, data) {
                return labelsTooltips[tooltipItem[0]["index"]];
              },
            },
          },
          scales: {
            xAxes: [
              {
                display: true,
                ticks: {
                  beginAtZero: true,
                  steps: 1,
                  stepValue: 1,
                  max: this.nPages,
                  maxTicksLimit: this.nPages + 1,
                },
                scaleLabel: {
                  display: true,
                  labelString: situationsLabel,
                },
              },
            ],
            yAxes: [
              {
                display: true,
                scaleLabel: {
                  display: true,
                  labelString: testsLabel,
                },
              },
            ],
          },
        },
      });
    });
  }

  applyFilter(filterValue: string) {
    if (filterValue === null) {
      this.dataSource.filter = "";
    } else {
      this.dataSource.filter = filterValue.trim().toLowerCase();
    }
  }

  private formatLabel(str: string, maxwidth: number): any {
    const sections = [];
    const words = str.split(" ");
    let temp = "";

    words.forEach(function (item, index) {
      if (temp.length > 0) {
        const concat = temp + " " + item;

        if (concat.length > maxwidth) {
          sections.push(temp);
          temp = "";
        } else {
          if (index === words.length - 1) {
            sections.push(concat);
            return;
          } else {
            temp = concat;
            return;
          }
        }
      }

      if (index === words.length - 1) {
        sections.push(item);
        return;
      }

      if (item.length < maxwidth) {
        temp = item;
      } else {
        sections.push(item);
      }
    });

    return sections;
  }

  private addToTableData(
    key: string,
    tot: any,
    translations: string[],
    quartiles: any = []
  ): CorrectionData {
    let descr, elemName;
    this.translate.get(translations).subscribe((res: any) => {
      descr = res["TEST_RESULTS." + key];
      elemName = res["TEST_ELEMENTS." + tot["elem"]];
    });

    const scs = tests[key]["scs"].split(",").map((scs) => scs.trim()) || [
      tests[key]["scs"].trim(),
    ];
    const fps = new Array<string>();

    for (const sc of scs || []) {
      for (const clause in users || {}) {
        if (users[clause]["WCAG 2.1"] === sc) {
          const types = users[clause]["Benefits"];
          for (const type of types.split(" ") || []) {
            if (!fps.includes(type)) {
              fps.push(type);
            }
          }
        }
      }
    }

    return {
      level: tests[key]["level"].toUpperCase(),
      elem: tot["elem"],
      element: elemName,
      description: descr,
      scs: tests[key]["scs"],
      fps: fps.join(", "),
      websites: tot["n_websites"],
      pages: tot["n_pages"],
      pagesPercentage: ((tot["n_pages"] / this.nPages) * 100).toFixed(1),
      elems: tot["result"] === "passed" ? -1 : tot["n_times"],
      quartiles: tot["result"] === "passed" ? "-" : quartiles,
      elemGroup: this.elemGroups[tot["elem"]],
    };
  }

  getDisplayedColumns() {
    return this.columnDefinitions.filter((cd) => !cd.hide).map((cd) => cd.def);
  }
  getDisplayedColumnsMobile() {
    return this.columnDefinitionsMobile
      .filter((cd) => !cd.hide)
      .map((cd) => cd.def);
  }
}

function calculateQuartiles(d: any, test: any): Array<any> {
  const data = d.website.getPassedWarningOccurrencesByPage(test);

  const values = without(data, undefined).sort((a, b) => a - b);

  let q1, q2, q3, q4;

  q1 = values[Math.round(0.25 * (values.length + 1)) - 1];

  if (values.length % 2 === 0) {
    q2 = (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  } else {
    q2 = values[(values.length + 1) / 2];
  }

  q3 = values[Math.round(0.75 * (values.length + 1)) - 1];
  q4 = values[values.length - 1];

  const tmp = {
    q1: new Array<number>(),
    q2: new Array<number>(),
    q3: new Array<number>(),
    q4: new Array<number>(),
  };

  let q;
  for (const v of values) {
    if (v <= q1) {
      q = "q1";
    } else {
      if (v <= q2) {
        q = "q2";
      } else {
        if (v <= q3) {
          q = "q3";
        } else {
          q = "q4";
        }
      }
    }

    tmp[q].push(v);
  }

  const final = new Array<any>();

  for (const k in tmp) {
    if (k) {
      const v = tmp[k];
      const sum = size(v);

      if (sum > 0) {
        const test = {
          tot: sum,
          por: Math.round((sum * 100) / values.length),
          int: {
            lower: v[0],
            upper: v[sum - 1],
          },
        };

        final.push(clone(test));
      }
    }
  }
  return final;
}

export interface CorrectionData {
  level: string;
  elem: string;
  element: string;
  description: string;
  scs: string;
  fps: string;
  websites: number;
  pages: number;
  pagesPercentage: string;
  elems: number;
  quartiles: any;
  elemGroup: string;
}
