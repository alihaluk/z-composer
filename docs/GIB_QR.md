# GİB Karekod (e-Fatura, e-Arşiv, e-İrsaliye, e-Adisyon)

Source: Gelir İdaresi Başkanlığı, *Karekod Standardı Kılavuzu*, version 1.1 (27.07.2023), published at [ebelge.gib.gov.tr](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/Karekod_Standardi_Kilavuzu_V.1.1.pdf). The guide is the authority; this page only summarizes what a template needs.

## How Z-Composer handles it

The karekod content is a JSON object built from the document's UBL data. The firm's system produces it, because it already has the UBL values and because the VAT keys depend on the rates on each document (see below). The template binds a QR element to the catalog field that holds this JSON; in the default catalog that is `Document.QrContent`.

In the designer, **Set up as GİB karekod** (QR properties) binds the element to that field and places it in the top-right corner of its band, as the guide asks. Adding that field from the field list does the same: it becomes a karekod QR in the top-right corner, wherever it is dropped. The e-Fatura, e-Arşiv, e-İrsaliye and e-Adisyon templates already do this; their sample catalogs carry karekod contents with the keys below. The QR is printed with error correction level Q at 2 dots per module, about 22 mm wide for a full e-Fatura JSON at 203 dpi; use **Fit box** in the properties to match the box to the sample data.

The guide does not set a QR size or error correction level.

## JSON keys for e-Fatura and e-Arşiv Fatura

| Key | Content | UBL element |
|---|---|---|
| `vkntckn` | Sender VKN (10 digits) or TCKN (11 digits) | `AccountingSupplierParty/Party/PartyIdentification/ID` |
| `avkntckn` | Receiver VKN or TCKN | `AccountingCustomerParty/Party/PartyIdentification/ID` |
| `senaryo` | Scenario, e.g. `TEMELFATURA`, `TICARIFATURA`; `EARSIVFATURA` for e-Arşiv | `ProfileID` |
| `tip` | Invoice type code, e.g. `SATIS`, `IADE`, `TEVKIFAT`, `ISTISNA` | `InvoiceTypeCode` |
| `tarih` | Issue date, `YYYY-MM-DD` | `IssueDate` |
| `no` | Document number: 3 alphanumeric characters, 4-digit year, 9-digit serial (16 characters) | `ID` |
| `ettn` | ETTN (UUID) | `UUID` |
| `parabirimi` | Currency code, e.g. `TRY` | `DocumentCurrencyCode` |
| `malhizmettoplam` | Goods and services total | `LegalMonetaryTotal/LineExtensionAmount` |
| `kdvmatrah(R)` | VAT base for rate R, e.g. `kdvmatrah(20)` | `TaxTotal/TaxSubtotal/TaxableAmount` |
| `hesaplanankdv(R)` | VAT amount for rate R, e.g. `hesaplanankdv(20)` | `TaxTotal/TaxSubtotal/TaxAmount` |
| `vergidahil` | Total including taxes | `LegalMonetaryTotal/TaxInclusiveAmount` |
| `odenecek` | Payable amount | `LegalMonetaryTotal/PayableAmount` |

- There is one `kdvmatrah(R)` / `hesaplanankdv(R)` pair for every VAT rate on the document, which is why the JSON is built outside the template.
- The guide's examples write every value as a string, amounts with a point and two decimals (`"1080.00"`).
- The guide also defines karekod content for e-SMM, e-MM, e-Sigorta Komisyon Gider and e-Döviz ve Kıymetli Maden; their keys differ and are listed in the guide.

## JSON keys for e-İrsaliye (guide section 2.3)

`vkntckn`, `avkntckn`, `senaryo` (e.g. `TEMELIRSALIYE`), `tip` (e.g. `SEVK`), `tarih`, `no`, `ettn`, `sevktarihi` (actual despatch date, `YYYY-MM-DD`), `sevkzamani` (actual despatch time, `HH:mm:ss`), `tasiyicivkn` (carrier VKN, when a carrier ships) and `plaka` (licence plate, when the firm ships itself).

## JSON keys for e-Adisyon (guide section 2.8)

`vkntckn`, `avkntckn`, `senaryo` (`EARSIVBELGE`), `tip` (`ADISYON`), `tarih`, `no`, `ettn` and `odenecek(TRY)`: the payable amount, with the currency code in the key.

## Placement and exemption

- The karekod is placed in the top-right corner of the electronic document.
- e-Arşiv invoices issued on hand-held terminals by the businesses the guide names (EPDK-licensed gas and electricity distributors and suppliers, M1 / M2 licensed cargo and logistics firms, and firms with written permission) need no karekod on the paper copy; the stored electronic copy must still show it.
