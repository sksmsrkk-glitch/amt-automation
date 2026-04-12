// ============================================================
// 사용자 프론트엔드 App 컴포넌트
// ------------------------------------------------------------
// 전체 라우트 정의 + 공통 Header/Footer 레이아웃.
// 각 페이지는 React.lazy 로 코드 스플리팅되어 첫 로드 성능을 개선한다.
// ============================================================

import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import './App.css'

// 페이지 지연 로드 (초기 번들 사이즈 축소)
const Home = lazy(() => import('./pages/Home'))
const HotelList = lazy(() => import('./pages/HotelList'))
const HotelDetail = lazy(() => import('./pages/HotelDetail'))
const TicketList = lazy(() => import('./pages/TicketList'))
const TicketDetail = lazy(() => import('./pages/TicketDetail'))
const PackageList = lazy(() => import('./pages/PackageList'))
const PackageDetail = lazy(() => import('./pages/PackageDetail'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'))
const MyBookings = lazy(() => import('./pages/MyBookings'))
const BookingDetail = lazy(() => import('./pages/BookingDetail'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Profile = lazy(() => import('./pages/Profile'))
const OrderLookup = lazy(() => import('./pages/OrderLookup'))

// 지연 로드 중 표시할 공통 로딩 스피너
function LoadingFallback() {
  return (
    <div className="loading-container" style={{ minHeight: '60vh' }}>
      <div className="spinner" />
      <div className="loading-text">Loading...</div>
    </div>
  )
}

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/hotels" element={<HotelList />} />
            <Route path="/hotels/:id" element={<HotelDetail />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/packages" element={<PackageList />} />
            <Route path="/packages/:id" element={<PackageDetail />} />
            <Route path="/booking/:type/:id" element={<BookingPage />} />
            <Route path="/booking/confirmation/:bookingId" element={<BookingConfirmation />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/my-bookings/:id" element={<BookingDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/order-lookup" element={<OrderLookup />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
