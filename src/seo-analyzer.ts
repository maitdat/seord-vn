import type {HtmlAnalyzer} from "./html-analyzer";
import type {ContentJson, Heading, KeywordDensity} from "./interfaces";

export class SeoAnalyzer {

    MINIMUM_KEYWORD_DENSITY = 0.46
    MAXIMUM_KEYWORD_DENSITY = 1.1

    MAXIMUM_SUB_KEYWORD_DENSITY = 0.9
    MINIMUM_SUB_KEYWORD_DENSITY = 0.12
    EXTREME_LOW_SUB_KEYWORD_DENSITY = 0.09

    MAXIMUM_META_DESCRIPTION_LENGTH = 160
    MAXIMUM_META_DESCRIPTION_DENSITY = 5
    MINIMUM_META_DESCRIPTION_DENSITY = 2

    MAXIMUM_TITLE_LENGTH = 70
    MINIMUM_TITLE_LENGTH = 40

    MAXIMUM_SUB_KEYWORD_IN_META_DESCRIPTION_DENSITY = 5
    MINIMUM_SUB_KEYWORD_IN_META_DESCRIPTION_DENSITY = 2

    public content: ContentJson;
    public htmlAnalyzer: HtmlAnalyzer;
    public keywordDensity: number;
    public strictMode: boolean;
    public headings: Heading[] = [];

    public messages: { warnings: string[], minorWarnings: string[], goodPoints: string[] } = {
        warnings: [],
        minorWarnings: [],
        goodPoints: []
    }

    constructor(content: ContentJson, htmlAnalyzer: HtmlAnalyzer, strictMode: boolean = false) {
        this.content = content;
        this.htmlAnalyzer = htmlAnalyzer;
        this.strictMode = strictMode;
        this.keywordDensity = this.calculateDensity(this.content.keyword);
        this.headings = this.htmlAnalyzer.getAllHeadingTags();
        if (!strictMode) {
            this.headings.push(
                {
                    tag: 'H1',
                    'text': this.content.title
                }
            )
        }
        this.assignMessages();
    }


    getSubKeywordsDensity(): KeywordDensity[] {
        const densities: KeywordDensity[] = [];
        for (const subKeyword of this.content.subKeywords) {
            let data: KeywordDensity = {
                keyword: subKeyword,
                density: this.calculateDensity(subKeyword)
            }
            densities.push(data);
        }
        return densities;
    }

    totalUniqueInternalLinksCount(): number {
        return this.htmlAnalyzer.getInternalLinks().unique.length;
    }

    totalUniqueExternalLinksCount(): number {
        return this.htmlAnalyzer.getOutboundLinks().unique.length;
    }

    getKeywordInTitle(keyword: string | null = null): KeywordDensity {
        keyword = keyword ?? this.content.keyword as string;
        const density = this.calculateDensity(keyword, this.content.title);
        return {
            keyword,
            density,
            position: this.getPosition(this.content.title, keyword)
        } as KeywordDensity;
    }

    getPosition(text: string, keyword: string) {
        if (!text || !keyword) return -1;
        return text.split(keyword)[0].split(' ').length
    }

    getSubKeywordsInTitle(): KeywordDensity[] {
        let subKeywordsInTitle: KeywordDensity[] = []
        this.content.subKeywords.forEach((sub_keyword: string) => {
            subKeywordsInTitle.push(this.getKeywordInTitle(sub_keyword));
        })
        return subKeywordsInTitle;
    }

    getKeywordInMetaDescription(keyword: string | null = null): KeywordDensity {
        if (keyword === null) {
            keyword = this.content.keyword as string;
        }
        const density = this.calculateDensity(keyword, this.content.metaDescription);
        return {
            keyword,
            density,
            position: this.getPosition(this.content.metaDescription, keyword)
        } as KeywordDensity;
    }

    getSubKeywordsInMetaDescription(): KeywordDensity[] {
        let subKeywordsInTitle: KeywordDensity[] = []
        this.content.subKeywords.forEach((sub_keyword: string) => {
            subKeywordsInTitle.push(this.getKeywordInMetaDescription(sub_keyword));
        })
        return subKeywordsInTitle;
    }


    getSeoScore(): number {
        const MAX_SCORE = 100;
        const {warnings, goodPoints} = this.messages;
        const messagesScore = ((goodPoints.length) / (warnings.length + goodPoints.length)) * 100;
        return Math.min(messagesScore, MAX_SCORE); // SEO score should never go above 100
    }

    getKeywordSeoScore(): number {
        const MAX_SCORE = 100;
        const keywordInTitle = this.getKeywordInTitle();
        const subKeywordsInTitle = this.getSubKeywordsInTitle();
        const subKeywordsDensity = this.getSubKeywordsDensity();
        const keywordInTitleScore = keywordInTitle.density * 10;
        const subKeywordsInTitleScore = subKeywordsInTitle.length * 10;
        const subKeywordsDensityScore = subKeywordsDensity.reduce((total, subKeywordDensity) => {
            return total + (subKeywordDensity.density * 10);
        }, 0);
        const keywordDensityScore = this.keywordDensity * 10;
        const totalScore = keywordInTitleScore + subKeywordsInTitleScore + subKeywordsDensityScore + keywordDensityScore;
        return Math.min(totalScore, MAX_SCORE); // SEO score should never go above 100
    }

    getTitleWordCount(): number {
        return this.htmlAnalyzer.getWordCount(this.content.title);
    }

    assignMessagesForKeyword() {
        // cảnh báo từ khóa không có trong nội dung
        if (this.content.keyword) {
            this.messages.goodPoints.push(`Tốt, nội dung của bạn có từ khóa "${this.content.keyword}".`);
            // cảnh báo nhồi nhét từ khóa
            if (this.keywordDensity > 5) {
                this.messages.warnings.push('Nhồi nhét từ khóa quá nhiều.');
            }
            // cảnh báo mật độ từ khóa quá cao hoặc quá thấp dựa trên độ dài nội dung
            if (this.keywordDensity < this.MINIMUM_KEYWORD_DENSITY) {
                this.messages.warnings.push(`Mật độ từ khóa quá thấp. Hiện tại là ${this.keywordDensity.toFixed(2)}%, hãy tăng thêm.`);
            } else if (this.keywordDensity > this.MAXIMUM_KEYWORD_DENSITY) {
                this.messages.warnings.push(`Mật độ từ khóa quá cao. Hiện tại là ${this.keywordDensity.toFixed(2)}%, hãy giảm bớt.`);
            } else {
                this.messages.goodPoints.push(`Mật độ từ khóa là ${this.keywordDensity.toFixed(2)}%.`);
            }
        } else {
            this.messages.warnings.push('Thiếu từ khóa chính, vui lòng thêm từ khóa.');
        }
    }

    assignMessagesForSubKeywords() {
        // cảnh báo từ khóa phụ trong nội dung
        if (this.content.subKeywords.length > 0) {
            this.messages.goodPoints.push(`Tốt, nội dung của bạn có từ khóa phụ "${this.content.subKeywords.join(', ')}".`);
            // cảnh báo mật độ từ khóa phụ
            const subKeywordsDensity = this.getSubKeywordsDensity();
            subKeywordsDensity.forEach((subKeywordDensity) => {
                if (subKeywordDensity.density > this.MAXIMUM_SUB_KEYWORD_DENSITY) {
                    this.messages.warnings.push(`Mật độ từ khóa phụ "${subKeywordDensity.keyword}" trong nội dung quá cao, hiện tại là ${subKeywordDensity.density.toFixed(2)}%.`);
                } else if (subKeywordDensity.density < this.MINIMUM_SUB_KEYWORD_DENSITY) {
                    let densityBeingLowString = subKeywordDensity.density < this.EXTREME_LOW_SUB_KEYWORD_DENSITY ? 'quá thấp' : 'thấp';
                    this.messages.minorWarnings.push(`Mật độ từ khóa phụ "${subKeywordDensity.keyword}" trong nội dung ${densityBeingLowString}, hiện tại là ${subKeywordDensity.density.toFixed(2)}%.`);
                } else {
                    this.messages.goodPoints.push(`Mật độ từ khóa phụ "${subKeywordDensity.keyword}" trong nội dung là ${subKeywordDensity.density.toFixed(2)}%, rất tốt.`);
                }
            });
        } else {
            this.messages.minorWarnings.push('Thiếu từ khóa phụ, vui lòng thêm một số từ khóa phụ.');
        }
    }

    assignMessagesForTitle() {
        // cảnh báo về tiêu đề nội dung và độ dài của nó
        if (this.content.title) {
            if (this.content.title.length > this.MAXIMUM_TITLE_LENGTH) {
                this.messages.warnings.push('Thẻ tiêu đề quá dài.');
            } else if (this.content.title.length < this.MINIMUM_TITLE_LENGTH) {
                this.messages.warnings.push('Thẻ tiêu đề quá ngắn.');
            } else {
                this.messages.goodPoints.push(`Thẻ tiêu đề có độ dài ${this.content.title.length} ký tự.`);
            }

            const keywordInTitle = this.getKeywordInTitle();
            if (keywordInTitle.density) {
                this.messages.goodPoints.push(`Mật độ từ khóa trong tiêu đề là ${keywordInTitle.density.toFixed(2)}%, rất tốt.`);
            } else {
                this.messages.warnings.push('Không có từ khóa chính trong tiêu đề.');
            }

            if (this.content.title) {
                if (this.getSubKeywordsInTitle().length > 0) {
                    this.messages.goodPoints.push(`Bạn có ${this.getSubKeywordsInTitle().length} từ khóa phụ trong tiêu đề.`);
                } else {
                    this.messages.minorWarnings.push('Không có từ khóa phụ trong tiêu đề.');
                }
            }
        } else {
            this.messages.warnings.push('Thiếu thẻ tiêu đề, vui lòng thêm một thẻ tiêu đề.');
        }
    }

    assignMessagesForLinks() {
        let wordCount = this.htmlAnalyzer.getWordCount();
        // Cảnh báo về số lượng liên kết nội bộ dựa trên độ dài nội dung
        if (this.totalUniqueInternalLinksCount() < (wordCount / 300)) {
            this.messages.warnings.push(`Số lượng liên kết nội bộ không đủ. Bạn chỉ có ${this.totalUniqueInternalLinksCount()} liên kết nội bộ duy nhất, hãy tăng số lượng lên.`);
        } else {
            this.messages.goodPoints.push(`Bạn có ${this.totalUniqueInternalLinksCount()} liên kết nội bộ.`);
        }

        // Cảnh báo về số lượng liên kết bên ngoài dựa trên độ dài nội dung
        if (this.totalUniqueExternalLinksCount() < (wordCount / 400)) {
            this.messages.warnings.push(`Số lượng liên kết bên ngoài không đủ. Bạn chỉ có ${this.totalUniqueExternalLinksCount()}, hãy tăng số lượng lên.`);
        }

        // Cảnh báo về các liên kết nội bộ bị trùng lặp
        if (this.htmlAnalyzer.getInternalLinks().duplicate.length > 1) {
            this.messages.minorWarnings.push(`Bạn có ${this.htmlAnalyzer.getInternalLinks().duplicate.length} liên kết nội bộ trùng lặp.`);
        } else {
            this.messages.goodPoints.push('Không có liên kết nội bộ trùng lặp.');
        }

        // Cảnh báo về các liên kết bên ngoài bị trùng lặp
        if (this.htmlAnalyzer.getOutboundLinks().duplicate.length > 1) {
            this.messages.minorWarnings.push(`Bạn có ${this.htmlAnalyzer.getOutboundLinks().duplicate.length} liên kết bên ngoài trùng lặp.`);
        } else {
            this.messages.goodPoints.push('Không có liên kết bên ngoài trùng lặp.');
        }
    }

    assignMessagesForMetaDescription() {
        if (this.content.metaDescription) {
            let keywordInMetaDescription = this.getKeywordInMetaDescription();
            // Cảnh báo về độ dài của meta description
            if (this.content.metaDescription.length > this.MAXIMUM_META_DESCRIPTION_LENGTH) {
                this.messages.warnings.push(`Meta description quá dài. Độ dài hiện tại là ${this.content.metaDescription.length} ký tự, hãy rút ngắn lại.`);
            } else if (this.content.metaDescription.length < 100) {
                this.messages.warnings.push(`Meta description quá ngắn. Độ dài hiện tại là ${this.content.metaDescription.length} ký tự, hãy tăng lên.`);
            } else {
                this.messages.goodPoints.push(`Meta description có độ dài ${this.content.metaDescription.length} ký tự.`);

                // Cảnh báo về mật độ từ khóa trong meta description
                if (keywordInMetaDescription.density > this.MAXIMUM_META_DESCRIPTION_DENSITY) {
                    this.messages.warnings.push(`Mật độ từ khóa trong meta description quá cao. Hiện tại là ${keywordInMetaDescription.density.toFixed(2)}%, hãy giảm xuống.`);
                } else if (keywordInMetaDescription.density < this.MINIMUM_META_DESCRIPTION_DENSITY) {
                    this.messages.warnings.push(`Mật độ từ khóa trong meta description quá thấp. Hiện tại là ${keywordInMetaDescription.density.toFixed(2)}%, hãy tăng lên.`);
                } else {
                    this.messages.goodPoints.push(`Mật độ từ khóa trong meta description là ${keywordInMetaDescription.density.toFixed(2)}%, rất tốt.`);
                }
            }

            // Cảnh báo về meta description không bắt đầu bằng từ khóa
            if (keywordInMetaDescription.position > 1) {
                this.messages.minorWarnings.push(`Meta description không bắt đầu bằng từ khóa. Nó bắt đầu bằng "${this.content.metaDescription.substring(0, 20)}", hãy thử bắt đầu bằng từ khóa. Không bắt đầu bằng từ khóa không phải vấn đề lớn, nhưng được khuyến nghị nên làm.`);
            } else {
                this.messages.goodPoints.push(`Meta description bắt đầu bằng từ khóa: "${this.content.metaDescription.substring(0, 20)}".`);
            }

            // Cảnh báo về mật độ từ khóa phụ trong meta description
            let subKeywordsInMetaDescription = this.getSubKeywordsInMetaDescription();
            subKeywordsInMetaDescription.forEach((subKeyword) => {
                if (subKeyword.density > this.MAXIMUM_SUB_KEYWORD_IN_META_DESCRIPTION_DENSITY) {
                    this.messages.warnings.push(`Mật độ từ khóa phụ "${subKeyword.keyword}" trong meta description quá cao, hiện tại là ${subKeyword.density.toFixed(2)}%.`);
                } else if (subKeyword.density < this.MINIMUM_SUB_KEYWORD_IN_META_DESCRIPTION_DENSITY) {
                    let densityBeingLowString = subKeyword.density < 0.2 ? 'quá thấp' : 'thấp';
                    this.messages.minorWarnings.push(`Mật độ từ khóa phụ "${subKeyword.keyword}" trong meta description ${densityBeingLowString}, hiện tại là ${subKeyword.density.toFixed(2)}%.`);
                } else {
                    this.messages.goodPoints.push(`Mật độ từ khóa phụ "${subKeyword.keyword}" trong meta description là ${subKeyword.density.toFixed(2)}%.`);
                }
            });
        } else {
            this.messages.warnings.push('Thiếu meta description.');
        }
    }

    filterHeading(headingTag) {
        return this.headings.filter((heading) => heading.tag.toLowerCase() === headingTag.toLowerCase());
    }
    assignMessagesForHeadings() {
        if (this.headings.length === 0) {
            this.messages.warnings.push('Thiếu thẻ heading, vui lòng thêm ít nhất một thẻ heading.');
        } else {
            this.messages.goodPoints.push(`Bạn có ${this.headings.length} thẻ heading.`);

            // Cảnh báo thiếu thẻ h1
            let headingsOne = this.filterHeading('h1');
            if (headingsOne.length === 0) {
                this.messages.warnings.push('Thiếu thẻ h1, vui lòng thêm ít nhất một thẻ h1.');
            } else if (headingsOne.length > 1) {
                this.messages.warnings.push('Có nhiều hơn một thẻ h1, vui lòng giữ lại một thẻ h1 và xóa các thẻ h1 khác.');
            } else {
                this.messages.goodPoints.push('Tuyệt vời! Bạn đã có thẻ h1, đây là thẻ quan trọng.');
            }

            // Cảnh báo cho thẻ h2
            let headingsTwo = this.filterHeading('h2');
            if (headingsTwo.length === 0) {
                this.messages.warnings.push('Thiếu thẻ h2, vui lòng thêm ít nhất một thẻ h2. Khuyến nghị nên có ít nhất một thẻ h2.');
            } else {
                this.messages.goodPoints.push('Tuyệt vời! Bạn đã có thẻ h2, đây là thẻ quan trọng.');
            }

            // Cảnh báo cho thẻ h3
            let headingsThree = this.filterHeading('h3');
            if (headingsThree.length === 0) {
                this.messages.minorWarnings.push('Thiếu thẻ h3, vui lòng thêm ít nhất một thẻ h3. Thẻ h3 không bắt buộc nhưng được khuyến nghị nên có ít nhất một thẻ h3.');
            } else {
                this.messages.goodPoints.push('Bạn đã có thẻ h3, điều này rất tốt.');
            }
        }
    }

    // Từ khóa trong các thẻ heading
    assignMessagesForKeywordInHeadings() {
        this.headings.forEach((heading) => {
            let keywordInHeading = this.countOccurrencesInString(this.content.keyword, heading.text);
            if (keywordInHeading > 0) {
                this.messages.goodPoints.push(`Từ khóa "${this.content.keyword}" được tìm thấy trong thẻ ${heading.tag} với nội dung "${heading.text}".`);
            } else {
                this.messages.minorWarnings.push(`Từ khóa "${this.content.keyword}" không được tìm thấy trong thẻ ${heading.tag} với nội dung "${heading.text}".`);
            }
        });
    }

    // Từ khóa phụ trong các thẻ heading
    assignMessagesForSubKeywordsInHeadings() {
        this.headings.forEach((heading) => {
            this.content.subKeywords.forEach((subKeyword) => {
                let subKeywordInHeading = this.countOccurrencesInString(subKeyword, heading.text);
                if (subKeywordInHeading > 0) {
                    this.messages.goodPoints.push(`Từ khóa phụ "${subKeyword}" được tìm thấy trong thẻ ${heading.tag} với nội dung "${heading.text}", điều này rất tốt.`);
                } else {
                    this.messages.minorWarnings.push(`Từ khóa phụ "${subKeyword}" không được tìm thấy trong thẻ ${heading.tag} với nội dung "${heading.text}".`);
                }
            });
        });
    }


    /**
     * Returns the messages object.
     * @return object The messages object.
     * @example
     * {
     *    goodPoints: [],
     *    warnings: [],
     *    minorWarnings: [],
     * }
     * @see SeoAnalyzer.messages
     */
    private assignMessages() {
        this.assignMessagesForKeyword();
        this.assignMessagesForSubKeywords();
        this.assignMessagesForTitle();
        this.assignMessagesForLinks();
        this.assignMessagesForMetaDescription();
        this.assignMessagesForKeywordInHeadings();
        this.assignMessagesForSubKeywordsInHeadings();
        this.assignMessagesForHeadings();
        return this.messages;
    }

    /**
     * Calculates the density of a keyword in the given string of body text.
     * @param keyword Should not be null.
     * @param bodyText If null, it will use the default value, i.e. `this.htmlAnalyzer.bodyText`
     */
    calculateDensity(keyword: string, bodyText: string | null = null): number {
        bodyText = bodyText ?? this.htmlAnalyzer.bodyText;
        return (this.countOccurrencesInString(keyword, bodyText) / this.htmlAnalyzer.getWordCount(bodyText)) * 100;
    }


    /**
     * Returns the number of occurrences of a keyword in a string. Or you can say, it returns the keyword count in the given string.
     * @param keyword If null, it will use the default value, i.e. `this.content.keyword`
     * @param stringContent If null, it will use the default value, i.e. `this.htmlAnalyzer.bodyText`
     * @return number The number of occurrences of the keyword in the string.
     */
    countOccurrencesInString(keyword: string | null = null, stringContent: string | null = null): number {
        keyword = keyword ?? this.content.keyword
        stringContent = stringContent ?? this.htmlAnalyzer.bodyText
        return stringContent.split(keyword).length - 1; // -1 because the split function will always return one more than the actual occurrences
    }

}

