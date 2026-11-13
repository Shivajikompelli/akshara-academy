import { ImageResponse } from 'next/og'

export interface ReceiptImageParams {
  studentName: string
  classLevel?: string
  amountPaid: string | number
  period: string
  paidDate: string
  receiptNo: string
  paymentMode?: string
}

export function generateReceiptPngResponse(params: ReceiptImageParams): ImageResponse {
  const {
    studentName,
    classLevel = 'Student',
    amountPaid,
    period,
    paidDate,
    receiptNo,
    paymentMode = 'CASH',
  } = params

  const formattedAmount = Number(amountPaid || 0).toLocaleString('en-IN')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#F8F9FE',
          padding: '28px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '2px solid #E9D5FF',
            overflow: 'hidden',
          }}
        >
          {/* Top Brand Header */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(145deg, #5B45E0 0%, #684FF6 55%, #886DFC 100%)',
              padding: '24px 32px',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  display: 'flex',
                }}
              >
                AKSHARA ACADEMY
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#EDEAFC',
                  marginTop: '4px',
                  display: 'flex',
                }}
              >
                Official Tuition Fee Receipt
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ECFDF5',
                color: '#047857',
                border: '2px solid #10B981',
                borderRadius: '9999px',
                padding: '8px 20px',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              PAID
            </div>
          </div>

          {/* Amount Banner */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F4F2FD',
              padding: '20px 32px',
              borderBottom: '1px solid #E9D5FF',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#5A6378',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                Amount Received
              </div>
              <div
                style={{
                  fontSize: '38px',
                  fontWeight: 700,
                  color: '#047857',
                  marginTop: '2px',
                  display: 'flex',
                }}
              >
                {`Rs. ${formattedAmount}`}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#5A6378',
                  display: 'flex',
                }}
              >
                Receipt No.
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#1F2438',
                  marginTop: '4px',
                  display: 'flex',
                }}
              >
                {receiptNo}
              </div>
            </div>
          </div>

          {/* Details Rows */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '22px 32px',
              gap: '16px',
              flex: 1,
            }}
          >
            {/* Row 1: Student Name & Class */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderBottom: '1px solid #F1F2F8',
                paddingBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', width: '55%' }}>
                <div style={{ fontSize: '13px', color: '#5A6378', display: 'flex' }}>
                  Student Name
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#1F2438',
                    marginTop: '4px',
                    display: 'flex',
                  }}
                >
                  {studentName}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '45%',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ fontSize: '13px', color: '#5A6378', display: 'flex' }}>
                  Class
                </div>
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#5B45E0',
                    marginTop: '4px',
                    display: 'flex',
                  }}
                >
                  {classLevel}
                </div>
              </div>
            </div>

            {/* Row 2: Fee Period & Payment Date */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                borderBottom: '1px solid #F1F2F8',
                paddingBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', width: '55%' }}>
                <div style={{ fontSize: '13px', color: '#5A6378', display: 'flex' }}>
                  Fee Period
                </div>
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#1F2438',
                    marginTop: '4px',
                    display: 'flex',
                  }}
                >
                  {period}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  width: '45%',
                  alignItems: 'flex-end',
                }}
              >
                <div style={{ fontSize: '13px', color: '#5A6378', display: 'flex' }}>
                  Payment Date & Mode
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#1F2438',
                    marginTop: '4px',
                    display: 'flex',
                  }}
                >
                  {`${paidDate} • ${paymentMode.toUpperCase()}`}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 32px',
              backgroundColor: '#F8F9FE',
              borderTop: '1px solid #E9D5FF',
              fontSize: '12px',
              color: '#5A6378',
            }}
          >
            <div style={{ display: 'flex' }}>
              Thank you for your payment — Akshara Academy
            </div>
            <div style={{ display: 'flex', fontWeight: 700, color: '#5B45E0' }}>
              Verified Digital Receipt
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 480,
    }
  )
}

