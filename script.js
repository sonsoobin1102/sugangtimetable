// --- 데이터 모델 및 전역 변수 ---
let subjects = []; // Subject 객체들의 배열
let sectionIdCounter = 0;
let generatedCombinations = [];
let currentCombinationIndex = 0;

// 교시 설정 (1교시 ~ 14교시)
// 1교시 = 09:00 ~ 10:00 (Start Hour 9)
// 14교시 = 22:00 ~ 23:00 (Start Hour 22)
const MAX_PERIOD = 9;  // 9교시 = 17:00 ~ 18:00
const START_HOUR_OFFSET = 8; // 1교시 + 8 = 9시
const START_HOUR = 9;
const END_HOUR = 17; // 17시 시작 수업이 마지막 (18시 종료)

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    loadSubjects(); // 저장된 데이터 로드
    renderTimetableGrid();
});

// --- 초기화 및 UI 관련 함수 ---
function initUI() {
    // 첫 번째 과목의 첫 번째 분반 입력 폼 자동 추가는 하지 않음 (사용자가 직접 추가)
    // 하지만 편의를 위해 페이지 로드 시 빈 분반 하나는 추가해줄 수 있음. 
    // 여기서는 '분반 추가' 버튼이 있으므로 생략하거나, 첫 분반 입력을 위해 자동으로 하나 띄워줌.
    // 첫 번째 과목의 첫 번째 분반 입력 폼 자동 추가는 하지 않음 (사용자가 직접 추가)
    // 하지만 편의를 위해 페이지 로드 시 빈 분반 하나는 추가해줄 수 있음. 
    // 여기서는 '분반 추가' 버튼이 있으므로 생략하거나, 첫 분반 입력을 위해 자동으로 하나 띄워줌.
    addSectionInput(); 

    // Toast Container 생성
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer); 

    // 이벤트 리스너 등록
    document.getElementById('addSectionBtn').addEventListener('click', addSectionInput);
    document.getElementById('addSubjectBtn').addEventListener('click', addSubject);
    document.getElementById('generateBtn').addEventListener('click', generateTimetable);
    document.getElementById('prevBtn').addEventListener('click', () => showCombination(currentCombinationIndex - 1));
    document.getElementById('nextBtn').addEventListener('click', () => showCombination(currentCombinationIndex + 1));
    
    // 신규 기능 이벤트 리스너
    document.getElementById('resetBtn').addEventListener('click', resetData);
    document.getElementById('downloadBtn').addEventListener('click', downloadTimetable);
    

    
    // 상위 요소에 이벤트 위임 (동적 생성된 요소들 처리)
    document.getElementById('sectionsContainer').addEventListener('click', (e) => {
        if (e.target.closest('.remove-section')) {
            e.target.closest('.section-input-item').remove();
            updateSectionIndices();
        }
        if (e.target.classList.contains('add-time')) {
            addTimeRow(e.target.closest('.section-input-item').querySelector('.section-times'));
        }
        if (e.target.closest('.remove-time')) {
            e.target.closest('.time-row').remove();
        }
    });

    document.getElementById('subjectList').addEventListener('click', (e) => {
        if (e.target.closest('.delete-subject')) {
            const index = e.target.closest('.subject-item').dataset.index;
            removeSubject(index);
        }
    });

    // 테마 변경 이벤트
    document.getElementById('themeSelect').addEventListener('change', (e) => {
        const theme = e.target.value;
        if (theme === 'default') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', theme);
        }
    });
}

function generatePeriodOptions() {
    let options = '';
    for (let p = 1; p <= MAX_PERIOD; p++) {
        const startH = p + START_HOUR_OFFSET;
        // const endH = startH + 1;
         // 예: 1교시
        options += `<option value="${p}">${p}교시</option>`;
    }
    return options;
}

// --- 입력 폼 관리 ---
function addSectionInput() {
    const container = document.getElementById('sectionsContainer');
    const template = document.getElementById('sectionInputTemplate');
    
    // 분반 최대 3개 제한
    if (container.querySelectorAll('.section-input-item').length >= 3) {
        showToast('분반은 최대 3개까지만 추가할 수 있습니다.', 'info');
        return;
    }

    const clone = template.content.cloneNode(true);
    
    // 시간대 하나 기본 추가
    const timesContainer = clone.querySelector('.section-times');
    addTimeRow(timesContainer);
    
    container.appendChild(clone);
    updateSectionIndices();
}

function addTimeRow(container) {
    const template = document.getElementById('timeRowTemplate');
    const clone = template.content.cloneNode(true);
    
    const startSelect = clone.querySelector('.start-period');
    const endSelect = clone.querySelector('.end-period');
    
    const options = generatePeriodOptions();
    startSelect.innerHTML = options;
    endSelect.innerHTML = options;
    
    // 기본값 설정 (1교시 ~ 1교시)
    startSelect.value = "1";
    endSelect.value = "1";

    container.appendChild(clone);
}

function updateSectionIndices() {
    const sections = document.querySelectorAll('.section-input-item');
    sections.forEach((sec, idx) => {
        sec.querySelector('.section-index').textContent = idx + 1;
    });
}

// --- 데이터 관리 (과목/분반 crud) ---
function addSubject() {
    const nameInput = document.getElementById('subjectName');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('과목명을 입력해주세요.', 'error');
        return;
    }
    
    // 학점 제한 검사 (임시 제외, 계산 후 마지막에 확인)

    const sectionInputs = document.querySelectorAll('.section-input-item');
    if (sectionInputs.length === 0) {
        showToast('최소 하나의 분반을 등록해야 합니다.', 'error');
        return;
    }

    const sections = [];
    
    // 각 분반 데이터 수집
    for (let i = 0; i < sectionInputs.length; i++) {
        const secInput = sectionInputs[i];
        const timeRows = secInput.querySelectorAll('.time-row');
        const timeSlots = [];
        
        timeRows.forEach(row => {
            const day = row.querySelector('.day-select').value;
            const startPeriod = parseInt(row.querySelector('.start-period').value);
            const endPeriod = parseInt(row.querySelector('.end-period').value);
            
            // 유효성 검사: 시작 교시가 종료 교시보다 클 수 없음
            if (startPeriod > endPeriod) {
                // 이 경우 그냥 무시하거나 swap? 일단 무시
            } else {
                // 내부적으로는 시간(Hour)으로 변환하여 저장
                // 1교시 시작=9시. 1교시 끝=10시.
                // 3교시 시작=11시. 3교시 끝=12시.
                // Start Period 1 ~ End Period 3 => 9:00 ~ 12:00
                const startHour = startPeriod + START_HOUR_OFFSET;
                const endHour = endPeriod + START_HOUR_OFFSET + 1; // 종료 교시가 끝나는 시간
                
                timeSlots.push({ 
                    day, 
                    start: startHour, 
                    end: endHour,
                    periodText: `${startPeriod}~${endPeriod}교시` // 표시용 텍스트
                });
            }
        });

        if (timeSlots.length === 0) {
            showToast(`분반 #${i+1}에 유효한 시간대가 없습니다.`, 'error');
            return;
        }

        sections.push({
            id: ++sectionIdCounter,
            index: i + 1,
            times: timeSlots
        });
    }

    // 과목 객체 생성 및 배열 추가
    // 학점 계산: 첫 번째 분반의 시간대 기준
    const firstSectionTimes = sections[0].times;
    let calculatedCredit = 0;
    firstSectionTimes.forEach(t => {
         calculatedCredit += (t.end - t.start);
    });

    // 학점(시간) 제한 검사: 최소 1학점 ~ 최대 3학점
    if (calculatedCredit < 1 || calculatedCredit > 3) {
        showToast(`수업 시간은 총 1시간(1학점) 이상, 3시간(3학점) 이하여야 합니다.\n(현재 입력: ${calculatedCredit}시간)`, 'error');
        return;
    }

    // 학점 제한 검사 (최대 24학점)
    const currentTotalCredits = subjects.reduce((sum, subj) => sum + subj.credit, 0);
    if (currentTotalCredits + calculatedCredit > 24) {
        showToast(`최대 24학점까지만 담을 수 있습니다.\n(현재: ${currentTotalCredits}학점 / 추가 시: ${currentTotalCredits + calculatedCredit}학점)`, 'error');
        return;
    }

    subjects.push({
        id: Date.now(),
        name: name,
        credit: calculatedCredit, 
        sections: sections,
        colorIndex: getRandomColorIndex() // Hex 대신 인덱스 저장
    });

    saveSubjects(); // 데이터 저장
    showToast(`${name} 과목이 등록되었습니다.`, 'success');

    // 입력 폼 초기화
    nameInput.value = '';
    document.getElementById('sectionsContainer').innerHTML = '';
    addSectionInput(); // 빈 것 하나 다시 추가

    renderSubjectList();
}

function removeSubject(index) {
    subjects.splice(index, 1);
    saveSubjects(); // 데이터 저장
    showToast('과목이 삭제되었습니다.', 'info');
    renderSubjectList();
}

function renderSubjectList() {
    const list = document.getElementById('subjectList');
    const countSpan = document.getElementById('subjectCount');
    const totalCreditsDisplay = document.getElementById('totalCreditsDisplay');
    
    countSpan.textContent = subjects.length;
    
    // 총 학점 계산 및 표시
    const totalCredits = subjects.reduce((sum, subj) => sum + subj.credit, 0);
    totalCreditsDisplay.textContent = `${totalCredits}학점 / 24학점`;
    if (totalCredits > 24) {
        totalCreditsDisplay.style.color = '#e74c3c'; // 경고색
    } else {
        totalCreditsDisplay.style.color = '#666';
    }

    list.innerHTML = '';

    if (subjects.length === 0) {
        list.innerHTML = '<div class="empty-state">등록된 과목이 없습니다.</div>';
        return;
    }

    subjects.forEach((subj, idx) => {
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.dataset.index = idx;
        
        let sectionsHtml = subj.sections.map(sec => {
            const timesStr = sec.times.map(t => {
                return t.periodText 
                    ? `${t.day} ${t.periodText}` 
                    : `${t.day} ${t.start}시-${t.end}시`;
            }).join(', ');
            return `<div>- 분반 ${sec.index}: ${timesStr}</div>`;
        }).join('');

        // 색상 변수 적용
        const colorVar = `var(--subj-${subj.colorIndex})`;

        item.innerHTML = `
            <div class="subject-header" style="border-left: 4px solid ${colorVar}; padding-left: 8px;">
                <span>${subj.name} (${subj.credit}학점)</span>
                <button class="btn-icon delete-subject" title="삭제">&times;</button>
            </div>
            <div class="subject-details">
                ${sectionsHtml}
            </div>
        `;
        list.appendChild(item);
    });
}

function getRandomColorIndex() {
    // 0 ~ 9 사이의 랜덤 인덱스 반환
    return Math.floor(Math.random() * 10);
}

// --- 알고리즘 (백트래킹) ---
function generateTimetable() {
    // 그리드 초기화 (에러 메시지나 이전 상태 제거 및 기본 구조 복구)
    renderTimetableGrid();

    if (subjects.length === 0) {
        showToast('과목을 먼저 등록해주세요.', 'info');
        return;
    }

    generatedCombinations = [];
    findCombinations(0, []);
    
    // 결과 UI 업데이트
    document.getElementById('resultSummary').classList.remove('hidden');
    document.getElementById('combinationCount').textContent = generatedCombinations.length;
    
    if (generatedCombinations.length > 0) {
        currentCombinationIndex = 0;
        showCombination(0);
        showToast(`총 ${generatedCombinations.length}개의 조합을 찾았습니다!`, 'success');
    } else {
        showToast('가능한 시간표 조합이 없습니다. 원인을 분석합니다...', 'error');
        analyzeConflicts();
    }
}

function analyzeConflicts() {
    const reasons = [];
    const isLunchGuaranteed = document.getElementById('lunchCheck').checked;

    // 1. 점심시간 충돌 분석
    if (isLunchGuaranteed) {
        subjects.forEach(subj => {
            // 해당 과목의 '모든' 분반이 점심시간 확보에 실패하는지 확인
            const allSectionsFail = subj.sections.every(sec => {
                // checkLunchBreak는 스케줄 배열을 받으므로, 임시 배열 생성
                // sec 객체 구조: { times: [...] }
                // checkLunchBreak가 { times: ... } 형태의 객체 배열을 기대함
                return !checkLunchBreak([{ times: sec.times }]);
            });

            if (allSectionsFail) {
                reasons.push(`🍱 <strong>[${subj.name}]</strong>의 모든 분반이 점심시간(11~14시 중 1시간)을 막고 있습니다.`);
            }
        });
    }

    // 2. 과목 간 1:1 충돌 분석
    for (let i = 0; i < subjects.length; i++) {
        for (let j = i + 1; j < subjects.length; j++) {
            const subjA = subjects[i];
            const subjB = subjects[j];

            // A 과목의 모든 분반과 B 과목의 모든 분반이 서로 충돌하는지 확인
            let allConflict = true;
            
            for (const secA of subjA.sections) {
                let sectionACompatible = false; // A의 이 분반이 B의 어떤 분반과라도 호환되는가?
                
                for (const secB of subjB.sections) {
                    if (!isSectionConflict(secA, secB)) {
                        sectionACompatible = true;
                        break; // 호환되는 것 찾음 -> 이 A 분반은 OK
                    }
                }
                
                if (!sectionACompatible) {
                    // A의 이 분반은 B의 어떤 것과도 안됨.
                    // 하지만 "모든 조합"이 안되는지 보려면.. 로직을 다시 생각
                    // "A와 B가 겹칩니다"라고 하려면, A,B를 동시에 수강할 수 있는 분반 조합이 단 하나도 없어야 함.
                    // 즉, (A의 어떤 분반, B의 어떤 분반) 쌍을 만들었을 때, 호환되는 쌍이 존재하면 충돌 아님.
                }
            }
            
            // 다시 구현: 호환되는 쌍이 하나라도 있으면 OK. 없으면 충돌.
            let hasCompatiblePair = false;
            for (const secA of subjA.sections) {
                for (const secB of subjB.sections) {
                    if (!isSectionConflict(secA, secB)) {
                        hasCompatiblePair = true;
                        break;
                    }
                }
                if (hasCompatiblePair) break;
            }

            if (!hasCompatiblePair) {
                 reasons.push(`<strong>[${subjA.name}]</strong>와(과) <strong>[${subjB.name}]</strong>의 시간표가 서로 겹칩니다.`);
            }
        }
    }

    // UI 표시
    const grid = document.getElementById('timetableGrid');
    grid.innerHTML = ''; // 초기화
    
    const reportBox = document.createElement('div');
    reportBox.style.gridColumn = "1 / -1";
    reportBox.style.gridRow = "1 / -1";
    reportBox.style.padding = "30px";
    reportBox.style.display = "flex";
    reportBox.style.flexDirection = "column";
    reportBox.style.justifyContent = "center";
    reportBox.style.alignItems = "center";
    reportBox.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    reportBox.style.zIndex = "10";
    reportBox.style.borderRadius = "12px";

    let html = '<h3 style="color:#e74c3c; margin-bottom:20px; font-size:1.5rem;">❌ 시간표를 완성할 수 없습니다</h3>';
    
    if (reasons.length > 0) {
        html += '<ul style="text-align:left; display:inline-block; font-size:1.1rem; line-height:1.8; color:#333;">';
        // 중복 제거 (혹시 모를)
        const uniqueReasons = [...new Set(reasons)];
        uniqueReasons.forEach(r => html += `<li>${r}</li>`);
        html += '</ul>';
    } else {
        html += '<p style="font-size:1.1rem; color:#555;">여러 과목이 복합적으로 얽혀있어 구체적인 원인을 찾기 어렵습니다.<br>과목 수를 줄이거나 조건을 완화해보세요.</p>';
    }
    
    reportBox.innerHTML = html;
    grid.appendChild(reportBox);
}

function isSectionConflict(secA, secB) {
    for (const timeA of secA.times) {
        for (const timeB of secB.times) {
            if (timeA.day === timeB.day) {
                // 시간 겹침 판별
                if (timeA.start < timeB.end && timeB.start < timeA.end) {
                    return true;
                }
            }
        }
    }
    return false;
}

function findCombinations(subjectIdx, currentSchedule) {
    // Base Case: 모든 과목에 대해 분반 선택 완료
    if (subjectIdx === subjects.length) {
        // 점심 시간 보장 체크 (옵션 활성화 시)
        // 기존엔 findCombinations 중간에서 체크했으나, '전체 스케줄'을 보고 빈 시간을 찾아야 하므로 완성된 시점에서 체크하는 것이 정확함
        if (document.getElementById('lunchCheck').checked) {
            if (!checkLunchBreak(currentSchedule)) return; // 조건 불만족 시 제외
        }

        // 깊은 복사로 저장 (참조 끊기)
        generatedCombinations.push([...currentSchedule]);
        return;
    }

    const currentSubject = subjects[subjectIdx];
    
    // 현재 과목의 각 분반에 대해 시도
    for (const section of currentSubject.sections) {
        // (구) 점심 공강 로직 삭제됨 -> Base Case에서 일괄 체크
        
        if (!isConflict(section, currentSchedule)) {
            // 선택: 현재 스케줄에 추가
            currentSchedule.push({
                subjectName: currentSubject.name,
                colorIndex: currentSubject.colorIndex, // 인덱스 전달
                ...section
            });
            
            // 다음 재귀 호출
            findCombinations(subjectIdx + 1, currentSchedule);
            
            // 백트래킹: 선택 취소 및 원상 복구
            currentSchedule.pop();
        }
    }
}

function isConflict(newSection, currentSchedule) {
    for (const existingItem of currentSchedule) {
        // 기존 선택된 분반들의 모든 시간대와
        for (const existingTime of existingItem.times) {
            // 새로 추가하려는 분반의 모든 시간대 비교
            for (const newTime of newSection.times) {
                if (existingTime.day === newTime.day) {
                    // 시간 겹침 판별: (StartA < EndB) && (StartB < EndA)
                    if (existingTime.start < newTime.end && newTime.start < existingTime.end) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

// 11:00 ~ 14:00 사이에 최소 1시간의 공강이 있는지 확인
function checkLunchBreak(schedule) {
    // 요일별로 11~14시 사이의 수업 시간대를 모음
    const dayMap = { '월': [], '화': [], '수': [], '목': [], '금': [] };
    
    // 스케줄 순회
    for (const item of schedule) {
        for (const t of item.times) {
            // 11시 ~ 14시와 겹치는 시간대만 추출
            // 수업 Start < 14 AND 수업 End > 11
            if (t.start < 14 && t.end > 11) {
                // 겹치는 구간만 잘라냄 (Clamping)
                const overlapStart = Math.max(t.start, 11);
                const overlapEnd = Math.min(t.end, 14);
                
                dayMap[t.day].push({ start: overlapStart, end: overlapEnd });
            }
        }
    }
    
    // 각 요일별 검사
    const days = ['월', '화', '수', '목', '금'];
    for (const day of days) {
        const intervals = dayMap[day];
        
        // 해당 요일에 점심 시간대 수업이 아예 없으면 OK (3시간 통비움)
        if (intervals.length === 0) continue;
        
        // 시간순 정렬
        intervals.sort((a, b) => a.start - b.start);
        
        // 빈 시간(Gap) 계산
        // 1. 11:00 ~ 첫 수업 시작
        if (intervals[0].start - 11 >= 1) continue; // 1시간 이상 비어있음 -> 통과
        
        // 2. 수업 사이사이 갭
        let foundGap = false;
        for (let i = 0; i < intervals.length - 1; i++) {
            if (intervals[i+1].start - intervals[i].end >= 1) {
                foundGap = true;
                break;
            }
        }
        if (foundGap) continue; // 통과
        
        // 3. 마지막 수업 종료 ~ 14:00
        if (14 - intervals[intervals.length - 1].end >= 1) continue; // 통과
        
        // 위 조건을 하나도 만족 못하면, 이 요일은 밥 먹을 시간이 없음 (Fail)
        return false;
    }
    
    return true; // 모든 요일 통과
}

// --- 시각화 (그리드 렌더링) ---
function renderTimetableGrid() {
    const grid = document.getElementById('timetableGrid');
    grid.innerHTML = ''; // 초기화

    // 헤더 생성
    const days = ['', '월', '화', '수', '목', '금'];
    days.forEach(day => {
        const div = document.createElement('div');
        div.className = 'grid-header';
        div.textContent = day;
        grid.appendChild(div);
    });

    // 그리드 셀 생성 (시간 + 5일)
    // grid-template-rows: Header(1) + 14 Periods
    let rowIndex = 2; // 1은 헤더

    for (let h = START_HOUR; h <= END_HOUR; h++) {
        // 시간 라벨
        const timeLabel = document.createElement('div');
        timeLabel.className = 'grid-cell time-label';
        
        // 시간 표시 (09:00, 10:00...)
        timeLabel.textContent = h < 10 ? `0${h}:00` : `${h}:00`; 
        
        // 위치 고정 (중요: 다른 요소에 밀리지 않도록)
        timeLabel.style.gridColumn = "1";
        timeLabel.style.gridRow = String(rowIndex);

        grid.appendChild(timeLabel);

        // 월~금 셀
        for (let d = 0; d < 5; d++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.coord = `${d}-${h}`; 
            
            // 셀도 위치를 명시하는 것이 안전함
            cell.style.gridColumn = String(d + 2);
            cell.style.gridRow = String(rowIndex);
            
            grid.appendChild(cell);
        }
        rowIndex++;
    }
}

function showCombination(index) {
    if (index < 0 || index >= generatedCombinations.length) return;
    
    currentCombinationIndex = index;
    
    // 버튼 상태 업데이트
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === generatedCombinations.length - 1;
    document.getElementById('pageIndicator').textContent = `${index + 1} / ${generatedCombinations.length}`;

    // 그리드 초기화 (내부 block 만 제거)
    clearGridEvents();

    const combination = generatedCombinations[index];
    const dayMap = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };

    combination.forEach(item => {
        item.times.forEach(t => {
            const dayIdx = dayMap[t.day];
            if (dayIdx === undefined) return;

            const duration = t.end - t.start; // 몇 시간인지
            const startH = t.start;
            
            const block = document.createElement('div');
            block.className = 'class-block';
            
            // 색상 적용 (CSS 변수)
            block.style.backgroundColor = `var(--subj-${item.colorIndex})`;
            
            block.innerHTML = `<strong>${item.subjectName}</strong><br>분반 ${item.index}`;
            
            // Grid 위치 지정
            block.style.gridColumn = dayIdx + 2; 
            
            // Row 계산
            const rowStart = startH - START_HOUR + 2;
            const rowEnd = rowStart + duration;
            
            block.style.gridRow = `${rowStart} / ${rowEnd}`;
            
            document.getElementById('timetableGrid').appendChild(block);
        });
    });
}

function clearGridEvents() {
    const blocks = document.querySelectorAll('.class-block');
    blocks.forEach(b => b.remove());
}

// --- Toast & Storage ---
function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function saveSubjects() {
    localStorage.setItem('subjects', JSON.stringify(subjects));
}

function loadSubjects() {
    const data = localStorage.getItem('subjects');
    if (data) {
        subjects = JSON.parse(data);
        // sectionIdCounter 복구 (최댓값 찾기)
        let maxId = 0;
        subjects.forEach(subj => {
            subj.sections.forEach(sec => {
                if (sec.id > maxId) maxId = sec.id;
            });
        });
        sectionIdCounter = maxId;
        renderSubjectList();
    }
}

function resetData() {
    if (!confirm('모든 과목 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
    
    subjects = [];
    sectionIdCounter = 0;
    generatedCombinations = [];
    currentCombinationIndex = 0;
    
    localStorage.removeItem('subjects');
    
    renderSubjectList();
    clearGridEvents();
    
    document.getElementById('resultSummary').classList.add('hidden');
    document.getElementById('sectionsContainer').innerHTML = '';
    addSectionInput();
    
    showToast('모든 데이터가 초기화되었습니다.', 'info');
}

function downloadTimetable() {
    const grid = document.getElementById('timetableGrid');
    
    // 모바일 등에서 스크롤 되어있을 수 있으므로 전체를 찍기 위해 임시 스타일 적용 가능
    html2canvas(grid, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'timetable.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast('시간표 이미지가 저장되었습니다! 📸', 'success');
    });
}
